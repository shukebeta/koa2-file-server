FROM nginx:stable-alpine as production-stage
ENV NGINX_VERSION 1.18.0
ENV PKG_RELEASE   1
RUN  set -x \
    && KEY_SHA512="e7fa8303923d9b95db37a77ad46c68fd4755ff935d0a534d26eba83de193c76166c68bfe7f65471bf8881004ef4aa6df3e34689c305662750c0172fca5d8552a *stdin" \
    && apk add --no-cache --virtual .cert-deps \
        openssl \
    && wget -O /tmp/nginx_signing.rsa.pub https://nginx.org/keys/nginx_signing.rsa.pub \
    && if [ "$(openssl rsa -pubin -in /tmp/nginx_signing.rsa.pub -text -noout | openssl sha512 -r)" = "$KEY_SHA512" ]; then \
        echo "key verification succeeded!"; \
        mv /tmp/nginx_signing.rsa.pub /etc/apk/keys/; \
    else \
        echo "key verification failed!"; \
        exit 1; \
    fi \
    && apk del .cert-deps \
    && apk add -X "https://nginx.org/packages/alpine/v$(egrep -o '^[0-9]+\.[0-9]+' /etc/alpine-release)/main" --no-cache nginx-module-image-filter=${NGINX_VERSION}-r${PKG_RELEASE}
RUN sed -i '1i\load_module modules/ngx_http_image_filter_module.so;' /etc/nginx/nginx.conf
COPY ./fileServer-testing.conf /etc/nginx/conf.d/fileServer.conf
COPY ./imageServer-testing.conf /etc/nginx/conf.d/imageServer.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

