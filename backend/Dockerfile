FROM node:20-alpine

WORKDIR /app

# Install deps first for Docker layer cache efficiency
COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

EXPOSE 3001

# Never run Node as root inside Docker
USER node

CMD ["node", "src/server.js"]
