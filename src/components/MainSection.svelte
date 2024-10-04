<script>
</script>

<section class="font-black bg-cover bg-center h-screen flex flex-col justify-center items-center text-center text-white">
    <div class="bg-black bg-opacity-75 p-8 rounded-lg shadow-lg">
        <slot></slot>
    </div>
</section>

<style>
    section {
        height: calc(100vh - 8rem); /* Adjust height to fit within the screen */
    }
</style>