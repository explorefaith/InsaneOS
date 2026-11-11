# insane-bash.sh — Insane OS Terminal shell integration for bash (the same escape sequences popular terminal emulators use).
#
# La terminal lanza `bash --rcfile insane-bash.sh -i`. Este archivo primero carga lo mismo
# que un shell de login (/etc/profile y ~/.bash_profile, ~/.bash_login o ~/.profile) y
# después agrega secuencias de escape estándar:
#   OSC 133;A / B   comienzo y fin del prompt (marcas para saltar entre comandos)
#   OSC 133;C       empieza la salida del comando
#   OSC 133;D;n     terminó el comando con código n (marca azul o roja)
#   OSC 7           directorio actual (pestañas nuevas abren ahí)
#   OSC 1337;RemoteHost=usuario@host   para el cambio automático de perfil por host

[ -r /etc/profile ] && . /etc/profile
if [ -r ~/.bash_profile ]; then . ~/.bash_profile
elif [ -r ~/.bash_login ]; then . ~/.bash_login
elif [ -r ~/.profile ]; then . ~/.profile
fi

if [ -n "$INSANE_TERM_INTEGRATION_LOADED" ] || [ "$TERM_PROGRAM" != InsaneTerminal ]; then return 0; fi
INSANE_TERM_INTEGRATION_LOADED=1

__insane_status() {
    local s=$?
    printf '\033]133;D;%s\007' "$s"
    printf '\033]7;file://%s%s\007' "${HOSTNAME:-localhost}" "$PWD"
    printf '\033]1337;RemoteHost=%s@%s\007' "$USER" "${HOSTNAME:-localhost}"
    return $s
}

__insane_wrap_ps1() {
    case "$PS1" in
        *'133;A'*) ;;
        *) PS1='\[\033]133;A\007\]'"$PS1"'\[\033]133;B\007\]' ;;
    esac
}

PS0=$'\033]133;C\007'"${PS0:-}"
if [[ "$(declare -p PROMPT_COMMAND 2>/dev/null)" == "declare -a"* ]]; then
    PROMPT_COMMAND=(__insane_status "${PROMPT_COMMAND[@]}" __insane_wrap_ps1)
else
    PROMPT_COMMAND="__insane_status${PROMPT_COMMAND:+; $PROMPT_COMMAND}; __insane_wrap_ps1"
fi

# Mensaje de error en el idioma de la región (LANGUAGE / LANG).
__insane_msg() {
    case "${LANGUAGE:-${LC_ALL:-${LC_MESSAGES:-$LANG}}}" in
        es*) echo "insane_imgcat: no se puede leer $1" ;;
        pt*) echo "insane_imgcat: não é possível ler $1" ;;
        *)   echo "insane_imgcat: cannot read $1" ;;
    esac
}

# imgcat: shows an image in the terminal (the OSC 1337 inline-image protocol).
#   imgcat [-w ancho] [-h alto] archivo...   (ancho/alto en celdas, "Npx", "N%" o auto)
insane_imgcat() {
    local f w=auto h=auto
    while [ $# -gt 0 ]; do
        case "$1" in
            -w) w=$2; shift 2 ;;
            -h) h=$2; shift 2 ;;
            *) break ;;
        esac
    done
    for f in "$@"; do
        [ -r "$f" ] || { __insane_msg "$f" >&2; continue; }
        printf '\033]1337;File=name=%s;width=%s;height=%s;inline=1:' "$(printf %s "$f" | base64 -w0)" "$w" "$h"
        base64 -w0 < "$f"
        printf '\007\n'
    done
}
command -v imgcat >/dev/null 2>&1 || alias imgcat=insane_imgcat

# Insignia (badge) en la esquina de la terminal: insane_badge "texto"
insane_badge() { printf '\033]1337;SetBadgeFormat=%s\007' "$(printf %s "$*" | base64 -w0)"; }
