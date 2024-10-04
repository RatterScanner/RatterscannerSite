<script lang="ts">
    import Footer from "../../components/Footer.svelte";
import Header from "../../components/Header.svelte";
    import MainSection from "../../components/MainSection.svelte";

</script>

<Header />

<MainSection>
    <h1 class="text-4xl font-mono">what's this?</h1>
    <div class="font-main font-light">
        <!-- can't get this to stay inline -->
        <!-- <nobr><p>RatterScanner is a malware scanner, specialised for Minecraft Forge mods.<p class="text-gray-500">(fabric soon!)</p></nobr> -->
        <p>RatterScanner is a malware scanner, specialised for Minecraft Forge mods. <i class="text-slate-700">(fabric soon!)</i></p>
        <p>When you upload a suspicious mod, our scanner runs the mod inside a contained, safe environment</p>
        <p>RatterScanner is a Discord bot, but this site allows usage outside of Discord.</p>
    </div>
</MainSection>

<Footer />