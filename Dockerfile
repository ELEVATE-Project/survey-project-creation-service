FROM node:20

#Set working directory 
WORKDIR /var/src/

#Copy package.json file
COPY ./src/package.json .

# Remove node_modules if they exist
RUN rm -rf node_modules

#Install node packages
RUN npm install && npm install -g nodemon@2.0.16
#Copy all files 
COPY ./src .

# Install netcat-openbsd
RUN apt-get update && apt-get install -y netcat-openbsd

#Expose the application port
EXPOSE 3000

#Start the application
CMD [ "node", "app.js" ]