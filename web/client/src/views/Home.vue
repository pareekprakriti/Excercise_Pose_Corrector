<script setup></script>

<template>
    <div class="container">
        <!-- Real-time camera mode -->
        <RouterLink :to="{ name: 'VideoStreaming' }" class="box">
            <i class="fa-solid fa-video"></i>
            <p class="box__description">Real Time</p>
        </RouterLink>

        <!-- Upload-and-analyze mode -->
        <RouterLink :to="{ name: 'UploadVideo' }" class="box">
            <i class="fa-solid fa-upload"></i>
            <p class="box__description">Video Upload</p>
        </RouterLink>
    </div>
</template>

<style lang="scss" scoped>
/* 1. Import the color module for modern Sass functionality */
@use "sass:color";

.container {
    margin-top: 10rem;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4rem;

    .box {
        width: 20%;
        max-width: 200px;
        aspect-ratio: 1 / 1;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        gap: 1.2rem;
        cursor: pointer;
        border: 4px solid var(--primary-color);
        border-radius: 10%;
        box-shadow: rgba(255, 255, 255, 0.1) 0px 1px 1px 0px inset,
            rgba(50, 50, 93, 0.25) 0px 50px 100px -20px,
            rgba(0, 0, 0, 0.3) 0px 30px 60px -30px;
        transition: all 0.2s ease-in;

        /* Example of how to use color.adjust if you needed a light background:
           background-color: color.adjust(#41b883, $lightness: 38%); 
        */

        i {
            font-size: 3rem;
            color: var(--primary-color);
        }

        &__description {
            font-size: 1.2rem;
            font-weight: 500;
            text-transform: uppercase;
            color: var(--secondary-color);
            transform: translateY(10px);
        }

        &:hover {
            transform: scale(1.05);
            /* Slightly lighten the border on hover using modern Sass */
            border-color: color.adjust(#41b883, $lightness: 10%);
        }
    }
}
</style>