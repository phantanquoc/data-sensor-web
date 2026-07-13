# Node 22 để khớp với môi trường dev (v22.14.0)
FROM node:22-alpine

WORKDIR /app

# Cài dependency trước để tận dụng cache layer
COPY package*.json ./
RUN npm install --omit=dev

# Copy toàn bộ source (kèm .env, views, pubic/)
COPY . .

EXPOSE 3000

# Chạy thẳng bằng node, không cần nodemon trong container
CMD ["node", "app.js"]
