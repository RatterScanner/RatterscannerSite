<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { get } from 'svelte/store';
    import Header from '../../../components/Header.svelte';
    import Footer from '../../../components/Footer.svelte';

    /**
     * @type {any[]}
     */
    let data = [];
    let loading = true;
    /**
     * @type {null}
     */
    let error = null;

    $: id = get(page).params.id;

    onMount(async () => {
        try {
            const response = await fetch(`https://api.example.com/data/${id}`);
            if (!response.ok) {
                throw new Error('Failed to fetch data');
            }
            data = await response.json();
        } catch (err) {
            // @ts-ignore
            error = err.message;
        } finally {
            loading = false;
        }
    });
</script>

<Header />

<main class="p-8">
    {#if loading}
        <p>Loading...</p>
    {:else if error}
        <p class="text-red-500">Error: {error}</p>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {#each data as item}
                <div class="bg-white p-6 rounded-lg shadow-lg">
                    <h2 class="text-2xl font-bold mb-2">{item.title}</h2>
                    <p class="text-gray-700">{item.description}</p>
                </div>
            {/each}
        </div>
    {/if}
</main>

<Footer />