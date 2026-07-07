# Nginx配置更新指南
# 为happynotes-uploader.yourdomain.com添加SSE支持

## 🚨 关键变更说明

### 1. 新增的location块

#### `/api/progress/` - SSE进度推送
```nginx
location /api/progress/ {
    # 🔥 SSE关键配置
    proxy_buffering off;              # 必须！禁用nginx缓冲
    proxy_cache off;                  # 必须！禁用缓存
    proxy_set_header X-Accel-Buffering no;  # 必须！立即传输
    proxy_read_timeout 3600s;         # 1小时超时，防止SSE断开
    
    # 其他配置...
}
```

#### `/api/upload` - 上传优化
```nginx
location /api/upload {
    # 🔥 流式上传配置
    proxy_request_buffering off;     # 不缓冲整个请求体
    proxy_send_timeout 1800s;        # 30分钟上传超时
    proxy_read_timeout 1800s;        # 匹配Flutter超时
    
    # 其他配置...
}
```

#### `/api/upload/status/` - 状态查询
```nginx
location /api/upload/status/ {
    # 标准代理配置，用于轮询方式的进度查询
}
```

### 2. 重要配置调整

#### 文件大小限制
```nginx
# 从10M增加到50M
client_max_body_size 50M;
```

#### 超时配置
```nginx
# 上传API专用超时
proxy_send_timeout 1800s;         # 30分钟（匹配Flutter客户端）
proxy_read_timeout 1800s;

# SSE专用超时
proxy_read_timeout 3600s;         # 1小时（保持长连接）
```

## 🔧 部署步骤

### 1. 备份现有配置
```bash
sudo cp /etc/nginx/conf.d/happynotes-uploader.yourdomain.com.conf \
       /etc/nginx/conf.d/happynotes-uploader.yourdomain.com.conf.backup
```

### 2. 更新配置文件
将新配置内容替换到现有文件：
```bash
sudo nano /etc/nginx/conf.d/happynotes-uploader.yourdomain.com.conf
# 将上面的完整配置粘贴进去
```

### 3. 测试配置
```bash
sudo nginx -t
```

### 4. 重新加载nginx
```bash
sudo nginx -s reload
```

## 🧪 测试新功能

### 测试SSE连接
```bash
curl -H "Accept: text/event-stream" \
     -H "Cache-Control: no-cache" \
     https://happynotes-uploader.yourdomain.com/api/progress/test123
```

期望结果：连接保持打开，而不是立即关闭。

### 测试上传API
```bash
curl -X POST \
     -F "img=@test-image.jpg" \
     https://happynotes-uploader.yourdomain.com/api/upload
```

### 测试状态查询API
```bash
curl https://happynotes-uploader.yourdomain.com/api/upload/status/test123
```

## 📊 监控和日志

### 查看SSE连接日志
```bash
tail -f /var/log/nginx/happynotes-uploader.yourdomain.com.access.log | grep progress
```

### 查看上传日志
```bash
tail -f /var/log/nginx/happynotes-uploader.yourdomain.com.access.log | grep upload
```

### 查看错误日志
```bash
tail -f /var/log/nginx/happynotes-uploader.yourdomain.com.error.log
```

## ⚠️ 注意事项

### 1. 向下兼容性
- ✅ 现有客户端继续正常工作
- ✅ 不传`uploadId`的请求走原有逻辑
- ✅ 响应格式保持不变

### 2. 性能考虑
- 监控长连接数量：`ss -tln | grep :443 | wc -l`
- SSE连接会保持1小时，注意资源占用
- 如有大量并发，考虑调整`worker_connections`

### 3. 安全考虑
- CORS配置允许所有域名访问（`*`）
- 如需限制，将`*`改为具体域名
- SSL配置由Certbot管理，无需修改

## 🔄 回滚方案

如果新配置有问题：
```bash
# 快速回滚
sudo cp /etc/nginx/conf.d/happynotes-uploader.yourdomain.com.conf.backup \
       /etc/nginx/conf.d/happynotes-uploader.yourdomain.com.conf
sudo nginx -s reload
```

## 📈 预期效果

部署后，Flutter客户端将获得：
1. **实时上传进度条** - 显示网络传输进度
2. **服务器处理进度** - 显示图片压缩/处理进度  
3. **自动降级** - SSE失败时使用客户端进度
4. **更好的用户体验** - 大文件上传时用户能看到持续进度

现有的demo.html页面和其他客户端不受影响，继续正常工作。