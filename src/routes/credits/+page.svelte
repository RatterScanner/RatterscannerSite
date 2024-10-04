<script lang="ts">
    import Footer from "../../components/Footer.svelte";
    import Header from "../../components/Header.svelte";
    import ScrollableSection from "../../components/ScrollableSection.svelte";

</script>

<Header />

<ScrollableSection>
    <h1 class="text-[96px] font-main">Credits</h1>

    <h1>RatterScanner is owned by:</h1>
    <div class="flex justify-around p-5 border-2 border-gray-300 rounded-2xl mt-5">
        <div class="flex flex-col items-center p-3">
            <img src="https://cdn.discordapp.com/avatars/564353701003657216/3e6daddebecdcc5aaf657202a84f9a19.png?size=1024" alt="Quint" class="w-24 h-24 rounded-full mb-3" />
            <p>Quint</p>
        </div>
        <div class="flex flex-col items-center p-3">
            <img src="https://cdn.discordapp.com/avatars/243517648552329216/a085758a4cb2753b40561c94c06a1aaf.png?size=1024" alt="Lenny" class="w-24 h-24 rounded-full mb-3" />
            <p>Lenny</p>
        </div>
    </div>

    <h1 class="pt-4">File Checkers:</h1>
    <div class="flex justify-around p-5 border-2 border-gray-300 rounded-2xl mt-4">
        <div class="flex flex-col items-center p-3">
            <img src="https://cdn.discordapp.com/avatars/790736254714642453/326f61aced648c03d96df1fa35b3e486.png?size=1024" alt="Axle" class="w-24 h-24 rounded-full mb-3" />
            <p>Axle</p>
        </div>
        <div class="flex flex-col items-center p-3">
            <img src="https://cdn.discordapp.com/avatars/673366857838755858/8a6062da9d0c2f71423e4d3d237ff14d.png?size=1024" alt="ByzantineProcess" class="w-24 h-24 rounded-full mb-3" />
            <p>ByzantineProcess</p>
        </div>
        <div class="flex flex-col items-center p-3">
            <img src="https://cdn.discordapp.com/avatars/371665471050612737/d31299449bf4379153d27345a04df1c9.png?size=1024" alt="Ghosty" class="w-24 h-24 rounded-full mb-3" />
            <p>Ghosty</p>
        </div>
        <div class="flex flex-col items-center p-3">
            <img src="https://cdn.discordapp.com/avatars/721281478238928906/a97b4616ed4500b055517800cd1e7131.png?size=1024" alt="Sylus" class="w-24 h-24 rounded-full mb-3" />
            <p>Sylus</p>
        </div>
    </div>



</ScrollableSection>

<Footer />