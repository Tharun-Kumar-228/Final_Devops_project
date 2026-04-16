# Base Image: Use the official lightweight Node.js 18 image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the package.json dependency tracking files
COPY package*.json ./

# Install project dependencies internally
RUN npm install

# Copy all static application assets, app.js logic, and server.js logic
COPY . .

# Explicitly expose Port 3000 for the Node instance
EXPOSE 3000

# Entrypoint defining how to launch the backend server
CMD ["node", "server.js"]
