FROM mhart/alpine-node:latest
WORKDIR /app
COPY . .
RUN npm install
ENV MONGO_HOST mongodb
ENV REDIS_HOST redis
EXPOSE 3000
CMD ["npm", "start"]