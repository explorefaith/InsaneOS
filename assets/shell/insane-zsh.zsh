# insane-zsh.zsh — InsaneOS Terminal shell integration for zsh (the same escape sequences popular terminal emulators use).
# Mismas secuencias que insane-bash.sh: OSC 133 A/B/C/D (marcas de prompt y comandos),
# OSC 7 (directorio) y OSC 1337 RemoteHost (usuario@host, para el cambio automático de perfil).

[[ "$TERM_PROGRAM" == InsaneTerminal && -z "$INSANE_TERM_INTEGRATION_LOADED" ]] || return 0
typeset -g INSANE_TERM_INTEGRATION_LOADED=1
typeset -g __insane_ran=0

__insane_precmd() {
    local s=$?
    (( __insane_ran )) && printf '\033]133;D;%s\007' "$s"
    __insane_ran=0
    printf '\033]7;file://%s%s\007' "${HOST:-localhost}" "$PWD"
    printf '\033]1337;RemoteHost=%s@%s\007' "$USER" "${HOST:-localhost}"
    printf '\033]133;A\007'
    # fin del prompt: se agrega a PS1 si el tema lo reemplazó
    [[ "$PS1" == *'133;B'* ]] || PS1="$PS1"$'%{\e]133;B\a%}'
    # que este hook quede último aunque .zshrc agregue otros (temas como p10k)
    precmd_functions=(${precmd_functions:#__insane_precmd} __insane_precmd)
}

__insane_preexec() {
    __insane_ran=1
    printf '\033]133;C\007'
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd __insane_precmd
add-zsh-hook preexec __insane_preexec

# Mensaje de error en el idioma de la región (LANGUAGE / LANG).
__insane_msg() {
    case "${LANGUAGE:-${LC_ALL:-${LC_MESSAGES:-$LANG}}}" in
        es*) echo "insane_imgcat: no se puede leer $1" ;;
        pt*) echo "insane_imgcat: não é possível ler $1" ;;
        *)   echo "insane_imgcat: cannot read $1" ;;
    esac
}

# imgcat y insane_badge, como en bash
insane_imgcat() {
    local f w=auto h=auto
    while (( $# )); do
        case "$1" in
            -w) w=$2; shift 2 ;;
            -h) h=$2; shift 2 ;;
            *) break ;;
        esac
    done
    for f in "$@"; do
        [[ -r "$f" ]] || { __insane_msg "$f" >&2; continue; }
        printf '\033]1337;File=name=%s;width=%s;height=%s;inline=1:' "$(printf %s "$f" | base64 -w0)" "$w" "$h"
        base64 -w0 < "$f"
        printf '\007\n'
    done
}
(( $+commands[imgcat] )) || alias imgcat=insane_imgcat
insane_badge() { printf '\033]1337;SetBadgeFormat=%s\007' "$(printf %s "$*" | base64 -w0)"; }
