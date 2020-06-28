# build stage
FROM node:12.16.2 as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY .env.testing ./.env
EXPOSE 3000
CMD ["npm", "start"]


