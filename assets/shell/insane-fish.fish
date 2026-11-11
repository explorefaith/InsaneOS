# insane-fish.fish — InsaneOS Terminal shell integration for fish (the same escape sequences popular terminal emulators use).
# La terminal lanza `fish -l --init-command 'source …/insane-fish.fish'`: corre después de la
# configuración del usuario. Mismas secuencias que bash/zsh: OSC 133 A/B/C/D, OSC 7 y
# OSC 1337 RemoteHost.

if status is-interactive; and test "$TERM_PROGRAM" = InsaneTerminal; and not set -q INSANE_TERM_INTEGRATION_LOADED
    set -g INSANE_TERM_INTEGRATION_LOADED 1
    set -g __insane_ran 0

    function __insane_prompt_start --on-event fish_prompt
        set -l s $status
        test $__insane_ran = 1; and printf '\e]133;D;%s\a' $s
        set -g __insane_ran 0
        printf '\e]7;file://%s%s\a' (prompt_hostname) "$PWD"
        printf '\e]1337;RemoteHost=%s@%s\a' "$USER" (prompt_hostname)
        printf '\e]133;A\a'
    end

    function __insane_preexec --on-event fish_preexec
        set -g __insane_ran 1
        printf '\e]133;C\a'
    end

    # fin del prompt (133;B) después del prompt del usuario o del tema
    if functions -q fish_prompt
        functions -c fish_prompt __insane_user_prompt
        function fish_prompt
            __insane_user_prompt
            printf '\e]133;B\a'
        end
    end

    function insane_imgcat
        set -l w auto
        set -l h auto
        while set -q argv[1]
            switch $argv[1]
                case -w
                    set w $argv[2]; set -e argv[1..2]
                case -h
                    set h $argv[2]; set -e argv[1..2]
                case '*'
                    break
            end
        end
        for f in $argv
            if not test -r $f
                switch "$LANGUAGE$LC_ALL$LC_MESSAGES$LANG"
                    case 'es*'
                        echo "insane_imgcat: no se puede leer $f" >&2
                    case 'pt*'
                        echo "insane_imgcat: não é possível ler $f" >&2
                    case '*'
                        echo "insane_imgcat: cannot read $f" >&2
                end
                continue
            end
            printf '\e]1337;File=name=%s;width=%s;height=%s;inline=1:' (printf %s $f | base64 -w0) $w $h
            base64 -w0 < $f
            printf '\a\n'
        end
    end
    command -q imgcat; or alias imgcat=insane_imgcat

    function insane_badge
        printf '\e]1337;SetBadgeFormat=%s\a' (printf %s "$argv" | base64 -w0)
    end
end
