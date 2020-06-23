# koa-file-server


Simple file upload server that supports uploading **Multiple** files to the server by simple config.

It is based on [koa-file-uploader](https://www.npmjs.com/package/koa-file-uploader). Many thanks to the original Author!

## install & setup & run

	git clone git@github.com:shukebeta/koa2-file-server.git
	cd koa2-file-server
	npm install
    cp .env.dev .env	
	npm run demo

## Config

see the `.env.dev`
A .env file located in the root directory of the application stores its configuration data.

here is an example of the content of .env file:

    IP=192.168.178.51
    PORT=3000
    ALLOWED_ORIGIN_LIST=http://localhost:8080,https://yourdomain.com,https://dev.yourdomain.com
    FILE_FIELD_NAME=img
    ALLOWED_EXT=.png,.jpg
    MAX_FILE_SIZE=2048
    DESTINATION=./files
    SAVE_AS_MD5=1
    API_URI=/api/upload


	DB_HOST=192.168.178.52
	DB_PORT=3306
	DB_NAME=YangtaoStandard
	DB_USERNAME=YangtaoABC
	DB_PASSWORD="YangtaoABC@%#8.0"
	DB_DIALECT=mysql


## About database migration
https://stackoverflow.com/questions/27835801/how-to-auto-generate-migrations-with-sequelize-cli-from-sequelize-models
