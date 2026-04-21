# frontend.Dockerfile

FROM node:20-alpine

WORKDIR /app

# Copy only package files first (for caching)
COPY ../frontend/package*.json ./

RUN npm install

# Copy the rest of the application code
COPY ../frontend ./

RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "run", "start"]