# Use a lightweight Linux base with Node.js
FROM node:18-bullseye-slim

# Install Calibre (contains ebook-convert)
# We also need libegl1 and libopengl0 for newer Calibre versions
RUN apt-get update && \
    apt-get install -y calibre libegl1 libopengl0 && \
    rm -rf /var/lib/apt/lists/*

# Set up app
WORKDIR /app
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Create persistent volume folders
RUN mkdir -p /app/uploads /app/books

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "server.js"]
