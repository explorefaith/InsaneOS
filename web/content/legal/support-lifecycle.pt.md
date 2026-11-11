Esta página explica quais versões do Insane OS recebem correções, como as atualizações chegam até você e o que planejamos para depois da versão 1.0.

## Situação atual: beta

O Insane OS **0.8.0 beta** é a primeira versão pública (a 0.7.0 nunca foi publicada). O que cada versão traz está nas notas dela no [GitHub Releases](https://github.com/insaneos/Insane OS/releases). As versões beta podem mudar comportamentos, ajustes e formatos de arquivo de uma versão para outra, e não são pensadas para trabalho crítico. Veja os [Termos de uso](/legal/terms/).

## Quais versões recebem correções

Até a 1.0, **só a última versão beta** recebe correções, incluindo as de segurança. Quando sai um beta novo, o anterior deixa de recebê-las, então atualize para a versão mais recente. Não levamos correções para betas anteriores.

## Como as atualizações chegam

O Insane OS tem dois tipos de atualização:

- **A base Debian.** O kernel, os drivers, as bibliotecas e todos os pacotes do Debian recebem as atualizações do Debian, incluindo as de segurança de `security.debian.org`. Instale-as pela aba Atualizações da Loja (ou Ajustes → Atualizações), ou com o `apt` no Terminal. Elas continuam chegando enquanto o Debian der suporte ao Debian 13.
- **O próprio Insane OS.** As versões novas do Insane OS são publicadas no [GitHub Releases](https://github.com/insaneos/Insane OS/releases) como pacote `.deb`, ISO para PC e imagem para Raspberry Pi 5, cada uma assinada (veja a página de [Assinatura de código](/legal/code-signing/)). No Debian, rodar de novo o instalador de uma linha (`curl -fsSL https://insaneos.org/install.sh | sh`) atualiza o Insane OS; você também pode instalar um `.deb` baixado pela Loja. Ainda não existe um atualizador próprio do Insane OS.

O Insane OS nunca procura nem baixa atualizações por conta própria: você decide quando.

## Depois da 1.0 (planejado)

Este é o nosso plano, não uma promessa, e pode mudar antes da 1.0:

- cada versão estável vai receber correções, incluindo as de segurança, até a próxima versão estável, mais um período de sobreposição para você ter tempo de atualizar;
- a base Debian vai seguir o ciclo de vida do Debian: quando o Debian encerrar o suporte de segurança de uma versão, o Insane OS vai passar para a versão seguinte do Debian antes dessa data;
- correções de segurança críticas serão publicadas assim que estiverem prontas, fora do calendário normal.

## Avisos de fim de suporte

Antes que uma versão deixe de receber correções, vamos anunciar em insaneos.org e no GitHub, com a data e a versão para a qual atualizar.

## Contato

Dúvidas: [nosso formulário de contato](https://www.iperfex.com/contacto/?lang=pt). Problemas de segurança: veja a [Política de segurança](/legal/security/).
