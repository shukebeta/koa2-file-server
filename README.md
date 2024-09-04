# A simple common FileServer

This project is based on [koa-file-uploader](https://www.npmjs.com/package/koa-file-uploader). Many thanks to the original Author!
It is not only an upload server but also a smart image server.

## File upload server

Requirements:

- You have to use the method "POST"
- The Content-Type header should be set to "multipart/form-data"
- The key-name must be **"img"** 
- Single file upload URI is **/api/upload**
- Multiple file upload URI is **/api/uploadMulti**

Here's a code snippet to describe how to upload file to this server.

        let $fileMulti = document.querySelector('input[multiple="multiple"]');
        let $file = document.querySelector('#file');
        const eventHandler = (e) => {
          document.querySelector('#result').innerText = "uploading..."
          var files = e.target.files;
          var form = new FormData();
          for (let file of files) {
            form.append('img', file);
          }
          var request = new XMLHttpRequest();
          let apiUri = '/api/uploadMulti'
          if (e.target.id === 'file') {
            apiUri = '/api/upload'
          }
          request.open("POST", `https://upload.your-domain.com${apiUri}`);
          request.onreadystatechange = (res) => {
            if (request.readyState === 4 && request.status === 200) {
              document.querySelector('#result').innerText = request.responseText;
              // let data = JSON.parse(request.responseText);

            }
          };
          request.send(form);
        }
        $file.addEventListener('change', eventHandler);
        $fileMulti.addEventListener('change', eventHandler);

### Single file upload

**POST** one image file to **/api/upload**, `<input type="file" name="img" />`
You can read the source code of `index.js` in the fileServer folder as a reference.

Response:

    {
        "success":true,
        "errorCode":0,
        "msg":"success",
        "data":{
            "fileName":"bbs.png",
            "filePath":"/51/25/",
            "originalFileName":"bbs.png",
            "url":"https://img.your-domain.com/320/51/25/bbs.png"}
        }
    }

### Multiple file upload

Post multiple image file to **/api/uploadMulti**, `<input type="file" multiple="multiple" name="img" />`
You can read the source code of `index.js` in the fileServer folder as a reference.

Response:

    {
        "success":true,
        "errorCode":0,
        "msg":"success",
        "data":[{
            "fileName":"bbs.png",
            "filePath":"/51/25/",
            "originalFileName":"bbs.png",
            "url":"https://img.your-domain.com/320/51/25/bbs.png"}
        }, {
            "fileName":"bbs.png",
            "filePath":"/51/25/",
            "originalFileName":"bbs.png",
            "url":"https://img.your-domain.com/320/51/25/bbs.png"}
        }, 
        ...
        ]
    }
    
## Smart Image Server

Every image will get an address like `https://img.your-domain.com/320/51/25/6a3744f6b19e1c0657820ef98ddd7fef.png`.
This address can be divided into 3 parts:

1. img host: https://img.your-domain.com/
2. filepath: /51/25/6a3744f6b19e1c0657820ef98ddd7fef.png
3. image width: 320 between imge host and filepath, you can change it to whatever width you actually need.

## Origin Image Server

`https://file.your-domain.com/51/25/6a3744f6b19e1c0657820ef98ddd7fef.png` will always give you the original image you uploaded.

## install & setup & run

	git clone git@github.com:shukebeta/koa2-file-server.git
	cd koa2-file-server
	npm install
    cp .env.develop .env	
    # modify your .env file to fit your environment
    # ensure your database is ready.
	docker-compose up -d

## Config

a sample file is located at [`.env.sample`](.env.sample)
A .env file located in the root directory of the application stores its configuration data.

here is an example of the content of .env file:

    # the internal upload server port
    PORT=3000

    # cors setup
    ALLOWED_ORIGIN_SUFFIX=localhost:8080,yourdomain.com

    # <input type=file name="img" />
    FILE_FIELD_NAME=img

    # allowed file type
    ALLOWED_EXT=.png,.jpg,.gif

    # 2048 means 2048 KB
    MAX_FILE_SIZE=2048

    # absolute dir is prefered
    DESTINATION=/data/files

    # the api uri for single file upload
    API_URI=/api/upload

    # the api uri for multiple file upload
    API_URI_MULTI=/api/uploadMulti

    # db config start
    DB_HOST=yourhost
    DB_PORT=3306
    DB_NAME=yourdbname
    DB_USERNAME=yourdbusername
    DB_PASSWORD=yourdbpassword
    DB_DIALECT=mysql
	# db config end

	# the image server for image display 
	IMG_SERVER=http://img.sample.domain.com

## About database migration
unfortunately, this migration toolkit is buggy. I don't recommend it after meeting a few serious bugs.
https://stackoverflow.com/questions/27835801/how-to-auto-generate-migrations-with-sequelize-cli-from-sequelize-models

- run `npx sequelize db:migrate` to initialize the `Files` table in your specified database.
