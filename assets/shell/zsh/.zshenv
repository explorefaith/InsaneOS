# .zshenv de InsaneOS Terminal — se usa solo para arrancar: la terminal lanza zsh con
# ZDOTDIR apuntando a esta carpeta. Acá se restaura el ZDOTDIR del usuario, se carga su
# propio .zshenv y se registra la integración (insane-zsh.zsh). Después zsh sigue leyendo
# .zprofile / .zshrc / .zlogin del usuario como siempre.
if [[ -n "${INSANE_ZDOTDIR+x}" ]]; then
    ZDOTDIR=$INSANE_ZDOTDIR
    unset INSANE_ZDOTDIR
else
    unset ZDOTDIR
fi
__insane_zsh_dir=${${(%):-%x}:A:h:h}
[[ -f "${ZDOTDIR:-$HOME}/.zshenv" ]] && source "${ZDOTDIR:-$HOME}/.zshenv"
[[ -o interactive && -r "$__insane_zsh_dir/insane-zsh.zsh" ]] && source "$__insane_zsh_dir/insane-zsh.zsh"
unset __insane_zsh_dir
