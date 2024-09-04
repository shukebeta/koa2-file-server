#!/bin/bash
if [ "$1" == "master" ]; then
  sed -i 's/\.dev\./\./' nginx/*.conf

  configFile=nginx/file.dev.shukebeta.com.conf
  # don't listen 80
  sed -i 's/listen 80/#listen 80/g' $configFile
  # enable ssl
  sed -i 's/#include/include/g' $configFile
  # add 80 redirect to 443
  sed 's/sample/file/g' nginx/snippets/sample-redirect.conf >> $configFile

  configFile=nginx/img.dev.shukebeta.com.conf
  sed -i 's/listen 80/#listen 80/g' $configFile
  sed -i 's/#include/include/g' $configFile
  sed 's/sample/img/g' nginx/snippets/sample-redirect.conf >> $configFile

  configFile=nginx/upload.dev.shukebeta.com.conf
  sed -i 's/listen 80/#listen 80/g' $configFile
  sed -i 's/#include/include/g' $configFile
  sed 's/sample/upload/g' nginx/snippets/sample-redirect.conf >> $configFile

  sed -i 's/80:80/8081:80/g' docker-compose.yml

  configFile=nginx/shukebeta.com.conf
  sed -i 's/#include/include/g' $configFile
elif [ "$1" == "local" ] ; then
  sed -i 's/file\.dev\./lfile\.dev\./g' nginx/file.dev.shukebeta.com.conf
  sed -i 's/img\.dev\./limg\.dev\./g' nginx/img.dev.shukebeta.com.conf
  sed -i 's/upload\.dev\./lupload\.dev\./g' nginx/upload.dev.shukebeta.com.conf
  sed -i 's/80:80/8081:80/g' docker-compose.yml
else
  rm ./nginx/shukebeta.com.conf
fi
docker-compose build
docker-compose down
docker-compose up -d
