# frontend.Dockerfile

FROM node:20-alpine

WORKDIR /app

# Copy only package files first (for caching)
COPY frontend/package*.json ./

RUN npm install

# Now copy the rest of the app
COPY frontend/ .

EXPOSE 3000

CMD ["npm", "run", "dev"]