# Frontend duy nhất: Vite dev server chạy trong Docker.
# Không build ra dist — backend không serve FE nữa, mọi truy cập qua port 5174.
FROM node:22-alpine

WORKDIR /app

# Cài dependency trước để tận dụng layer cache khi chỉ source thay đổi
COPY package*.json ./
RUN npm ci

# Source được mount qua volume trong docker-compose (HMR), COPY chỉ để
# image chạy được độc lập khi không mount.
COPY . ./

EXPOSE 5174

# --host 0.0.0.0 để truy cập được từ ngoài container
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5174", "--strictPort"]
