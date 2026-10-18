# Shell for the recorded terminal. Keys are read from .env into the environment and never printed.
REPO="/Volumes/Extreme SSD/Projects/xorv-arc"
export KAZUO_HOME="$HOME/.kazuo-arc-demo/provider"
export KAZUO_BROKER_URL="https://surround-ports-prime-audience.trycloudflare.com"
export KAZUO_PAYER_KEY="$(grep '^KAZUO_DEMO_PAYER_KEY=' "$REPO/.env" | cut -d= -f2-)"
export FORCE_COLOR=1
kazuo() { node "$REPO/packages/cli/dist/index.js" "$@"; }
PROMPT='%F{cyan}provider%f %F{240}~%f $ '
RPROMPT=''
cd "$HOME"
clear
