FROM node:8

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 31337 4002 4003

CMD ["npm","run", "start"]