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
- You must send an `Authorization: Bearer <JWT>` header. Both upload URIs require it; a request with no header is rejected with `401`, and one with an invalid or expired token with `403`.

The token is a JSON Web Token signed with the server's `JWT_SECRET`. This project does not mint tokens — issue them out of band (e.g. from your auth service) with the same secret the server is configured with.

Here's a code snippet to describe how to upload file to this server by node

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
          // Required: a JWT signed with the server's JWT_SECRET, minted out of band.
          const token = 'YOUR_JWT_HERE';
          request.setRequestHeader('Authorization', `Bearer ${token}`);
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
        "data": {
            "id": 23,
            "md5": "d8c933893793745228282aaed6141ce5",
            "path": "/50/99/",
            "fileName": "weibo-abnormal.png",
            "fileExt": ".png",
            "refCount": 3,
            "createdAt": 1727908785,
            "updatedAt": 1727908785,
            "url": "http://localhost:3333/320/50/99/d8c933893793745228282aaed6141ce5.png",
            "originalName": "weibo-abnormal.png",
            "fileSize": 20480
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
            "id": 23,
            "md5": "d8c933893793745228282aaed6141ce5",
            "path": "/50/99/",
            "fileName": "weibo-abnormal.png",
            "fileExt": ".png",
            "refCount": 3,
            "createdAt": 1727908785,
            "updatedAt": 1727908785,
            "url": "http://localhost:3333/320/50/99/d8c933893793745228282aaed6141ce5.png",
            "originalName": "weibo-abnormal.png",
            "fileSize": 20480
        }, {
            "id": 24,
            "md5": "d8c933893793745228282aaed6141ce5",
            "path": "/50/99/",
            "fileName": "weibo-abnormal.png",
            "fileExt": ".png",
            "refCount": 3,
            "createdAt": 1727908785,
            "updatedAt": 1727908785,
            "url": "http://localhost:3333/320/50/99/d8c933893793745228282aaed6141ce5.png",
            "originalName": "weibo-abnormal.png",
            "fileSize": 20480
        }, 
        ...
        ]
    }
    
## Upload progress (optional)

To track an in-flight upload, generate a random `uploadId` on the client and send it with the upload request — either as a `?uploadId=<id>` query parameter (which also enables live transfer progress) or as an `uploadId` form field. The demo page at `/` shows one way. Two endpoints are keyed on that id:

- **`GET /api/progress/:uploadId`** — a Server-Sent Events stream (`text/event-stream`) that pushes progress snapshots as the upload transfers and processes.
- **`GET /api/upload/status/:uploadId`** — a one-shot JSON snapshot of the same state; `404` if the id is unknown.

These endpoints are **not** JWT-guarded: the browser `EventSource` API cannot set an `Authorization` header, so the `uploadId` itself acts as a capability token. Generate it with cryptographic randomness and treat it as a secret — anyone who knows an `uploadId` can read that upload's progress.

## install & setup & run

	git clone git@github.com:shukebeta/koa2-file-server.git
	cd koa2-file-server
	npm install
    cp .env.example .env	
    # modify your .env file to fit your environment
    # ensure your database is ready.
	docker-compose up -d
    # check the last section of this README file to setup an image server for showing the images you uploaded locally.
    # launch your browser and navigate to http://localhost:{the port number you set in your .env file}

## Config

a sample file is located at [`.env.example`](.env.example)
A .env file located in the root directory of the application stores its configuration data.

here is an example of the content of .env file:

    # the internal upload server port
    PORT=3000

    # cors setup
    ALLOWED_ORIGIN_SUFFIX=localhost,yourdomain.com

    # <input type=file name="img" />
    FILE_FIELD_NAME=img

    # allowed file type
    ALLOWED_EXT=.png,.jpg,.gif,.jpeg

    # 2048 means 2048 KB
    MAX_FILE_SIZE=2048

    # absolute dir is prefered
    DESTINATION=/data/files

    # the api uri for single file upload
    API_URI=/api/upload

    # the api uri for multiple file upload
    API_URI_MULTI=/api/uploadMulti

    # db config start (sole source of the DB connection; NODE_ENV need not be set)
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
https://stackoverflow.com/questions/27835801/how-to-auto-generate-migrations-with-sequelize-cli-from-sequelize-models

- run `npx sequelize db:migrate` to initialize the `Files` table in your specified database.

## Want a responsive image server? check out the following project, and you can set up one in a few minutes

[Responsive image server](https://github.com/shukebeta/responsive-image-server)
