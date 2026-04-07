FROM node:20-alpine

# Install nginx
RUN apk add --no-cache nginx

WORKDIR /app

# Install backend dependencies
COPY backend/package.json ./
RUN npm install --production

# Copy backend source
COPY backend/server.js ./

# Copy frontend static files
COPY frontend/index.html /usr/share/nginx/html/index.html

# Copy nginx configuration
COPY frontend/nginx.conf /etc/nginx/http.d/default.conf

EXPOSE 80

# Start Node.js in background, then nginx in foreground
CMD ["sh", "-c", "node server.js & nginx -g 'daemon off;'"]
