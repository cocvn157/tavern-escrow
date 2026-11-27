# DoraHacks Submission Kit — Gnome Tavern Hackathon (`TavernEscrow`)

> **Naming Check:** `TavernEscrow` complies strictly with the Gnome Tavern rule prohibiting project names starting with `"Gno"` or implying official Gno.land endorsement.

## 1. Ready-to-Paste DoraHacks Fields

- **Project Name:** `TavernEscrow`
- **Track:** Default Track
- **Tagline / Short Description:**
  Deterministic multi-milestone `ugnot` bounty & dispute escrow realm for Gno.land (`onyx-1`) with EOA `IsUserCall()` payment guards, neutral arbiter settlement, `gnoweb` `Render(path)` explorer, chained SHA-256 audit log, and interactive adversarial workbench.
- **GitHub Repository:** `https://github.com/cocvn157/tavern-escrow`
- **Live Interactive Workbench (GitHub Pages):** `https://cocvn157.github.io/tavern-escrow/`
- **Live Deployed Realm (`gnoweb` — Question 1):** `https://onyx.testnets.gno.land/r/g1fhl5xrwkjy3enekd3puz5w8j2d4252uwhewdf4/tavernescrow` (`HTTP 200`, Bounty #1 funded `1,000,000 ugnot`)
- **Realm / Package Path (Question 2):** `gno.land/r/g1fhl5xrwkjy3enekd3puz5w8j2d4252uwhewdf4/tavernescrow`
- **Live On-Chain Proof (`onyx-1` via `https://rpc.onyx.testnets.gno.land:443`):**
  - `maketx addpkg`: Block `#1453448` · TX Hash `/TehXxlBPDy4FgrJywAvtmy7Hk2sq5v2Red5FCPXRHQ=`
  - `maketx call CreateBounty` (Bounty `#1` · `1,000,000 ugnot`): Block `#1453468` · TX Hash `WxnNK2Eq62km0vtz6HGUrESJO1yVYQwC1Ng/dG6+Uho=`
  - Live routes verified `HTTP 200`: [Board](https://onyx.testnets.gno.land/r/g1fhl5xrwkjy3enekd3puz5w8j2d4252uwhewdf4/tavernescrow) · [Bounty #1](https://onyx.testnets.gno.land/r/g1fhl5xrwkjy3enekd3puz5w8j2d4252uwhewdf4/tavernescrow:bounty/1) · [Audit](https://onyx.testnets.gno.land/r/g1fhl5xrwkjy3enekd3puz5w8j2d4252uwhewdf4/tavernescrow:audit) · [Safety](https://onyx.testnets.gno.land/r/g1fhl5xrwkjy3enekd3puz5w8j2d4252uwhewdf4/tavernescrow:safety)
- **Is this a new project? (Question 4):** New project created specifically during Gnome Tavern Hackathon (Nov 2026).
- **Country of residence (Question 7):** Vietnam
- **Contact for prize verification (Question 8):** `cocvn157@gmail.com`
- **KYC confirmation (Question 9):** `Yes`

---

## 2. Required 1-Minute Manual Testnet Deployment (`faucet.gno.land` + `gnokey`)

Because `https://faucet.gno.land` enforces an interactive human verification gate (and `gno`/`gnokey` must sign with your local keystore), run these steps once before pasting the final `gnoweb` link into DoraHacks Question 1.

> **Windows Availability Check (`gnolang/gno` `v1.8.0`):**
> Official GitHub releases (`https://github.com/gnolang/gno/releases/tag/v1.8.0`) currently publish `linux_*` and `darwin_*` binaries only (no native Windows `.exe` asset). On Windows, choose **Option A** (native build via Go `>= 1.25.9`) or **Option B** (WSL2 Linux binary):
>
> **Option A — Native Windows via Go (`go.mod` requires `go 1.25.9`):**
> ```powershell
> winget install GoLang.Go
> # Reopen PowerShell so `go` is on PATH, then:
> go install github.com/gnolang/gno/gno.land/cmd/gnokey@v1.8.0
> go install github.com/gnolang/gno/gnovm/cmd/gno@v1.8.0
> $env:Path += ";$env:USERPROFILE\go\bin"
> gnokey version; gno version
> ```
>
> **Option B — WSL2 Ubuntu + Official `v1.8.0` Prebuilt Linux Binaries:**
> ```powershell
> wsl --install -d Ubuntu
> # Inside WSL Ubuntu:
> curl -L -o /usr/local/bin/gnokey https://github.com/gnolang/gno/releases/download/v1.8.0/gnokey_linux_amd64
> curl -L -o /usr/local/bin/gno https://github.com/gnolang/gno/releases/download/v1.8.0/gno_linux_amd64
> chmod +x /usr/local/bin/gnokey /usr/local/bin/gno
> ```
>
> **Live Endpoint Check:** `https://rpc.onyx.testnets.gno.land/status` (`HTTP 200`, `chainid: onyx-1`), `https://onyx.testnets.gno.land/` (`HTTP 200`), and `https://faucet.gno.land` (`HTTP 200`). *(Note: `rpc.onyx-1.gno.land` is invalid/unreachable — always use `https://rpc.onyx.testnets.gno.land:443`.)*

1. **Create or inspect your local `gnokey` key:**
   ```bash
   gnokey add tavern-builder
   gnokey list
   ```
   Copy your `g1...` address.

2. **Request `onyx-1` testnet GNOT from the faucet:**
   - Open `https://faucet.gno.land` in your browser.
   - Paste your `g1...` address, complete the verification challenge, and receive testnet `ugnot`.

3. **Set your permissionless address namespace in `gnomod.toml`:**
   Update `gno/r/cocvn157/tavernescrow/gnomod.toml`:
   ```toml
   module = "gno.land/r/<YOUR_G1_ADDRESS>/tavernescrow"
   gno = "0.9"
   ```
   (And update the `gno.land/r/cocvn157/tavernescrow` links inside `render.gno` & `escrow_test.gno` if deploying under your `g1...` namespace.)

4. **Run local Gno tests and deploy to Onyx (`onyx-1`):**
   ```bash
   cd gno/r/cocvn157/tavernescrow
   gno test -v .

   gnokey maketx addpkg \
     -pkgpath "gno.land/r/<YOUR_G1_ADDRESS>/tavernescrow" \
     -pkgdir "." \
     -max-deposit "50000000ugnot" \
     -gas-fee 100000ugnot \
     -gas-wanted 8000000 \
     -chainid onyx-1 \
     -remote "https://rpc.onyx.testnets.gno.land:443" \
     tavern-builder
   ```

5. **Seed a live on-chain bounty & verify `gnoweb`:**
   ```bash
   gnokey maketx call \
     -pkgpath "gno.land/r/<YOUR_G1_ADDRESS>/tavernescrow" \
     -func "CreateBounty" \
     -args "Gnome Tavern Genesis Bounty" \
     -args "Verify deterministic escrow workflow on Onyx testnet" \
     -args "g10p5yt46ypn5wey48zqevauwjlyaghh5vtdz7yg" \
     -args "" \
     -args "Deploy Realm,Verify Render" \
     -args "500000,500000" \
     -args "99999999" \
     -send "1000000ugnot" \
     -gas-fee 25000ugnot \
     -gas-wanted 4000000 \
     -chainid onyx-1 \
     -remote "https://rpc.onyx.testnets.gno.land:443" \
     tavern-builder
   ```
   Paste the resulting live URL into DoraHacks Question 1:
   `https://onyx.testnets.gno.land/r/<YOUR_G1_ADDRESS>/tavernescrow`
