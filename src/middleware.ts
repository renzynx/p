import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const cookie = context.cookies.get("connect.sid")?.value;
  const protectedRoutes = ["/guild", "/files"];
  const pathname = new URL(context.request.url).pathname;
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!cookie) {
    console.log(new URL(context.request.url).pathname);
    if (isProtectedRoute) {
      return context.redirect(`${import.meta.env.PUBLIC_API_URL}/auth/login`);
    }

    context.locals.isAuthenticated = false;
    context.locals.user = null;

    return next();
  }

  const res = await fetch(`${import.meta.env.PUBLIC_API_URL}/auth/@me`, {
    headers: {
      Cookie: `connect.sid=${cookie}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    if (isProtectedRoute) {
      return context.redirect(`${import.meta.env.PUBLIC_API_URL}/auth/login`);
    }

    context.locals.isAuthenticated = false;
    context.locals.user = null;

    return next();
  }

  const user = await res.json();

  context.locals.isAuthenticated = true;
  context.locals.user = user;
  context.locals.cookie = `connect.sid=${cookie}`;

  return next();
});
