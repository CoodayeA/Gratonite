FROM nginx:1.27-alpine

# Landing page (pre-built Next.js static export)
COPY apps/landing/out /usr/share/nginx/landing

# Web app (pre-built Vite output)
COPY apps/web/dist /usr/share/nginx/html/app

COPY docker/hetzner/nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
