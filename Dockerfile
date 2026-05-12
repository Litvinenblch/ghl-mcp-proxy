FROM node:18-alpine

WORKDIR /app

# Install deps first for better layer caching
COPY package.json ./
RUN npm install --production --no-audit --no-fund

# Copy app
COPY server.js ./

ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]
