# Nginx配置 - 支持SSE进度推送

## 基础反向代理配置（已有）
```nginx
server {
    listen 80;
    server_name your-upload-server.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🚨 需要新增：SSE专用配置

### 方案1：为进度API添加专门的location块
```nginx
server {
    listen 80;
    server_name your-upload-server.com;
    
    # 普通上传API（保持现有配置）
    location /api/upload {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 上传相关优化
        client_max_body_size 100M;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # 🆕 SSE进度推送专用配置
    location /api/progress/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # SSE关键配置
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';
        
        # 🔥 SSE必需设置：禁用缓冲
        proxy_buffering off;
        proxy_cache off;
        
        # 🔥 保持连接活跃
        proxy_read_timeout 3600s;  # 1小时超时
        proxy_send_timeout 3600s;
        
        # 🔥 立即传输数据，不等缓冲区满
        proxy_set_header X-Accel-Buffering no;
        
        # 🔥 支持HTTP/1.1持久连接
        proxy_http_version 1.1;
        proxy_set_header Connection "keep-alive";
        
        # CORS支持（如果需要跨域）
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, OPTIONS';
        add_header Access-Control-Allow-Headers 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
    }
    
    # 其他API（保持现有配置）
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 方案2：全局优化配置（推荐用于生产环境）
```nginx
# 在http块中添加上游定义
upstream upload_backend {
    server 127.0.0.1:3000;
    keepalive 32;  # 保持连接池
}

server {
    listen 80;
    server_name your-upload-server.com;
    
    # 全局设置
    client_max_body_size 100M;
    
    # SSE进度推送
    location /api/progress/ {
        proxy_pass http://upload_backend;
        
        # SSE核心配置
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_http_version 1.1;
        proxy_set_header Connection "keep-alive";
        proxy_set_header X-Accel-Buffering no;
        
        # 标准代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS（如果需要）
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Credentials true;
    }
    
    # 文件上传
    location /api/upload {
        proxy_pass http://upload_backend;
        
        # 上传优化
        proxy_request_buffering off;  # 流式上传，不缓冲整个请求体
        proxy_connect_timeout 300s;
        proxy_send_timeout 1800s;    # 30分钟上传超时
        proxy_read_timeout 1800s;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        
        # 标准代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 其他API
    location /api/ {
        proxy_pass http://upload_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 静态文件（如果有）
    location /static/ {
        alias /path/to/static/files/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 🔥 关键配置说明

### SSE必需的nginx设置
```nginx
# 1. 禁用代理缓冲 - 最重要！
proxy_buffering off;
proxy_cache off;
proxy_set_header X-Accel-Buffering no;

# 2. 长连接支持
proxy_read_timeout 3600s;  # 防止连接过早断开
proxy_http_version 1.1;
proxy_set_header Connection "keep-alive";

# 3. CORS支持（跨域时必需）
add_header Access-Control-Allow-Origin *;
add_header Access-Control-Allow-Credentials true;
```

### 上传优化设置
```nginx
# 1. 流式上传（不缓冲整个文件到nginx）
proxy_request_buffering off;

# 2. 大文件支持
client_max_body_size 100M;  # 根据需要调整

# 3. 长超时时间
proxy_send_timeout 1800s;   # 30分钟
proxy_read_timeout 1800s;
```

## HTTPS配置（生产环境推荐）
```nginx
server {
    listen 443 ssl http2;
    server_name your-upload-server.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # SSL优化配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS;
    ssl_prefer_server_ciphers off;
    
    # 其余配置同上...
    
    # SSE在HTTPS下工作更稳定
    location /api/progress/ {
        # 同上面的SSE配置
    }
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name your-upload-server.com;
    return 301 https://$server_name$request_uri;
}
```

## 🚫 不需要WebSocket支持
```nginx
# ❌ 不需要这些WebSocket配置
# proxy_set_header Upgrade $http_upgrade;
# proxy_set_header Connection "upgrade";

# ✅ SSE只需要标准HTTP连接
# proxy_set_header Connection "keep-alive";
```

## 测试nginx配置
```bash
# 1. 检查配置语法
sudo nginx -t

# 2. 重新加载配置
sudo nginx -s reload

# 3. 测试SSE连接
curl -H "Accept: text/event-stream" \
     -H "Cache-Control: no-cache" \
     http://your-server.com/api/progress/test123

# 应该看到持续的SSE响应，而不是立即关闭
```

## 监控和调试
```nginx
# 在server块中添加日志
error_log /var/log/nginx/upload_error.log debug;
access_log /var/log/nginx/upload_access.log combined;

# 监控SSE连接
tail -f /var/log/nginx/upload_access.log | grep progress
```