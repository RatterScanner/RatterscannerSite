<script>
    import '../app.css';
    import Footer from '../components/Footer.svelte';
    import Header from '../components/Header.svelte';
    import HeroFileDrop from '../components/HeroFileDrop.svelte';
    let file;
    // @ts-ignore
    function handleFileUpload(event) {
        file = event.target.files[0];
        console.log(file);
    }
</script>

<Header />
<HeroFileDrop {handleFileUpload} />
<Footer />