<script>
    import MainSection from './MainSection.svelte';
    export let handleFileUpload;
</script>

<MainSection>
    <h1 class="text-4xl md:text-6xl font-black mb-4 text-white">Welcome to RatterScanner</h1>
    <p class="text-lg md:text-2xl font-extralight font-mono mb-8">the minecraft mod malware checker</p>
    <label class="font-mono mb-4 p-2 border-2 border-white text-white text-2xl rounded-lg cursor-pointer inline-block">
    <input type="file" on:change={handleFileUpload} class="hidden" accept=".jar" />
        Upload File
    </label>
</MainSection>