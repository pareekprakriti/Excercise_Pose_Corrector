<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
    <div class="site-container">
        <nav>
            <RouterLink :to="{ name: 'Home' }" class="nav__header">
                Exercise Correction
            </RouterLink>
        </nav>

        <main>
            <RouterView />
        </main>

        <footer></footer>
    </div>
</template>

<style lang="scss">
// Ensure these variables exist in your global CSS or define them here
:root {
    --primary-color: #42b983; 
    --font-family: 'Inter', sans-serif;
}

body {
    margin: 0;
    padding: 0;
    
    .site-container {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
    }

    nav {
        margin: 1.5rem 0 1rem; /* slightly tighter spacing above buttons */
        text-align: center;

        .nav__header {
            text-decoration: none;
            font-size: 2rem;
            font-family: var(--font-family);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--primary-color);
        }
    }

    main {
        margin-inline: auto;
        width: 90vw;
        flex-grow: 1; // Ensures main takes up space
    }

    footer {
        margin-top: auto;
        margin-inline: auto;
        width: 90vw;
        /* bottom line and padding removed for a cleaner edge */
        border-top: none;
        padding: 0;
    }
}
</style>