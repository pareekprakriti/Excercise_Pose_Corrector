import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: "/",
            name: "Home",
            component: () => import("../views/Home.vue"),
        },
        {
            path: "/realtime",
            name: "VideoStreaming",
            component: () => import("../views/VideoStreaming.vue"),
        },
        {
            path: "/upload",
            name: "UploadVideo",
            component: () => import("../views/UploadVideo.vue"),
        },
        {
            path: "/:pathMatch(.*)*",
            redirect: { name: "Home" },
        },
    ],
});

export default router;
