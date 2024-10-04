<script>
    import Footer from "../../components/Footer.svelte";
    import Header from "../../components/Header.svelte";
    import MainSection from "../../components/MainSection.svelte";
    import { onMount } from 'svelte';
  
    let value = '';
  
    /**
     * @param {{ preventDefault: () => void; }} event
     */
    function handleSubmit(event) {
        event.preventDefault();
        if (value) {
            const currentUrl = window.location.href;
            window.location.href = `${currentUrl}${value}`;
        }
    }
</script>

<Header />

<MainSection>
<form on:submit={handleSubmit}>
    <label for="value">Enter a numerical value:</label>
    <input type="number" id="value" bind:value={value} required />
    <button type="submit">Submit</button>
</form>
</MainSection>

<Footer />