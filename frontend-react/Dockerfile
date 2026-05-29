# Stage 1: Build & Development Environment
FROM node:22-alpine

WORKDIR /app

# Copy package descriptors first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose Vite default dev server port
EXPOSE 5173

# Start Vite dev server binding to 0.0.0.0 for host machine accessibility
CMD ["npm", "run", "dev", "--", "--host"]
