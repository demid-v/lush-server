FROM node:16

WORKDIR /usr/src/server

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5500

VOLUME [ "/app/node_modules" ]

CMD [ "npm", "start" ]