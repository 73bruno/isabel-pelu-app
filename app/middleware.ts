
import { auth } from "@/auth"

export default auth((req) => {
    // If not authenticated and trying to access protected route, NextAuth automatically handles redirect to sign-in
    // We can add custom logic here if needed, but default behavior is usually sufficient for simple protection.

    if (!req.auth && req.nextUrl.pathname !== "/login") {
        const newUrl = new URL("/api/auth/signin", req.nextUrl.origin)
        return Response.redirect(newUrl)
    }
})

// Configure which paths NOT to protect (static files, images, etc)
export const config = {
    matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"], // Protect everything except cron & statics
}
