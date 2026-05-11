FROM node:20

#Set working directory 
WORKDIR /var/src/

#Copy all files first
COPY ./src .

# Remove node_modules if they exist
RUN rm -rf node_modules

#Install node packages
RUN npm install && npm install -g nodemon@2.0.16

# Install netcat-openbsd
RUN apt-get update && apt-get install -y netcat-openbsd

#Expose the application port
EXPOSE 6001

#Start the application
CMD [ "node", "app.js" ]
