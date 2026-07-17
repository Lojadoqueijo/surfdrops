use strict; use warnings; use utf8; use Encode;

my $PW=595.28; my $PH=841.89;
my $LEFT=56; my $RIGHT=539; my $CW=$RIGHT-$LEFT;

my $DARK="0.16 0.18 0.21"; my $TEAL="0.07 0.40 0.60"; my $GREEN="0.10 0.62 0.22";
my $RED="0.82 0.16 0.16"; my $AMBER="0.92 0.66 0.10"; my $GRAY="0.45 0.45 0.45";
my $LIME="0.30 0.85 0.30"; my $MAROON="0.55 0.10 0.10"; my $TEALC="0.05 0.55 0.55";

sub esc { my $s=shift; my $b=Encode::encode('cp1252',$s,Encode::FB_DEFAULT);
  $b =~ s/([\\()])/\\$1/g; return $b; }
sub tx { my($x,$y,$f,$sz,$c,$s)=@_; return sprintf("BT /%s %s Tf %s rg %.2f %.2f Td (%s) Tj ET\n",$f,$sz,$c,$x,$y,esc($s)); }
sub wrap { my($t,$sz,$mw)=@_; my @w=split /\s+/,$t; my @ln; my $cur=""; my $cwf=$sz*0.50;
  for my $word (@w){ my $try=($cur eq "")?$word:"$cur $word"; if(length($try)*$cwf>$mw){ push @ln,$cur if $cur ne ""; $cur=$word;} else {$cur=$try;} }
  push @ln,$cur if $cur ne ""; return @ln; }
sub paraAt { my($buf,$ytop,$sz,$col,$t,$w)=@_; $w//= $CW; my $y=$ytop;
  for my $l (wrap($t,$sz,$w)){ push @$buf, tx($LEFT,$y,"F1",$sz,$col,$l); $y-=$sz*1.38; } return $y; }
sub pline { my($buf,$col,$w,@p)=@_; my $s=sprintf("%s RG %.1f w ",$col,$w);
  $s.=sprintf("%.1f %.1f m ",shift(@p),shift(@p)); while(@p){ $s.=sprintf("%.1f %.1f l ",shift(@p),shift(@p)); }
  $s.="S\n"; push @$buf,$s; }
sub candle { my($buf,$x,$o,$c,$l,$h,$y0,$sc)=@_;
  my $col = $c>=$o ? $GREEN : $RED;
  push @$buf, sprintf("%s RG 1 w %.1f %.1f m %.1f %.1f l S\n",$col,$x,$y0+$l*$sc,$x,$y0+$h*$sc);
  my ($a,$b)=($y0+$o*$sc,$y0+$c*$sc); my $bot=$a<$b?$a:$b; my $ht=abs($b-$a); $ht=2 if $ht<2;
  push @$buf, sprintf("%s rg %.1f %.1f 10 %.1f re f\n",$col,$x-5,$bot,$ht);
}
sub lbox { my($buf,$x,$y,$w,$h,$col,$txt,$tsz)=@_;
  push @$buf, sprintf("%s rg %.1f %.1f %.1f %.1f re f\n",$col,$x,$y,$w,$h);
  push @$buf, tx($x+4,$y+($h-$tsz)/2+1.5,"F2",$tsz,"1 1 1",$txt);
}
sub circ { my($buf,$x,$y,$r,$col)=@_; my $k=0.5523*$r;
  push @$buf, sprintf("%s rg %.2f %.2f m %.2f %.2f %.2f %.2f %.2f %.2f c %.2f %.2f %.2f %.2f %.2f %.2f c %.2f %.2f %.2f %.2f %.2f %.2f c %.2f %.2f %.2f %.2f %.2f %.2f c f\n",
   $col,$x+$r,$y,$x+$r,$y+$k,$x+$k,$y+$r,$x,$y+$r,$x-$k,$y+$r,$x-$r,$y+$k,$x-$r,$y,$x-$r,$y-$k,$x-$k,$y-$r,$x,$y-$r,$x+$k,$y-$r,$x+$r,$y-$k,$x+$r,$y);
}
sub numc { my($buf,$x,$y,$n)=@_; circ($buf,$x,$y,7,$TEAL); push @$buf, tx($x-2.7,$y-3.2,"F2",9,"1 1 1","$n"); }
sub diam { my($buf,$x,$y,$r,$col)=@_;
  push @$buf, sprintf("%s rg %.1f %.1f m %.1f %.1f l %.1f %.1f l %.1f %.1f l f\n",$col,$x,$y+$r,$x+$r,$y,$x,$y-$r,$x-$r,$y);
}
sub dashln { my($buf,$col,$x1,$y1,$x2,$y2)=@_;
  push @$buf, sprintf("%s RG 0.8 w [3 2] 0 d %.1f %.1f m %.1f %.1f l S [] 0 d\n",$col,$x1,$y1,$x2,$y2);
}
sub header { my($buf,$t)=@_;
  push @$buf, sprintf("%s rg 0 %.2f %.2f 46 re f\n",$TEAL,$PH-46,$PW);
  push @$buf, tx($LEFT,$PH-31,"F2",15,"1 1 1",$t);
}
sub footer { my($buf,$n)=@_;
  push @$buf, sprintf("0.65 0.65 0.65 RG 0.5 w 56 46 m 539 46 l S\n");
  push @$buf, tx(56,34,"F1",8.5,$GRAY,"SwellLine - Guia do Utilizador");
  push @$buf, tx(500,34,"F1",8.5,$GRAY,"pág. $n");
}
sub hd { my($buf,$y,$t)=@_; push @$buf, tx($LEFT,$y,"F2",13,$TEAL,$t); }

# candle set: ciclo completo (unidades de preço 0-100)
my @CY=(
 [30,36,26,39],[36,42,32,45],[42,39,36,46],[39,47,37,50],[47,54,44,57],
 [54,51,47,58],[51,60,49,63],[60,68,57,71],[68,80,65,84],[80,72,68,85],
 [72,52,49,74],[52,45,40,55],[45,37,33,48],[37,31,27,40],[31,35,28,38],
 [35,43,32,46],[43,57,41,60],[57,64,54,67]);

# ================= PÁGINA 1 — CAPA =================
my @P1;
push @P1, sprintf("%s rg 0 %.2f %.2f 170 re f\n",$TEAL,$PH-170,$PW);
push @P1, sprintf("1 1 1 RG 1.8 w 0 %.2f m 99 %.2f 198 %.2f 297 %.2f c 396 %.2f 495 %.2f 595 %.2f c S\n",
 $PH-140,$PH-124,$PH-156,$PH-140,$PH-124,$PH-156,$PH-140);
push @P1, sprintf("0.75 0.90 0.97 RG 1.2 w 0 %.2f m 99 %.2f 198 %.2f 297 %.2f c 396 %.2f 495 %.2f 595 %.2f c S\n",
 $PH-155,$PH-141,$PH-169,$PH-155,$PH-141,$PH-169,$PH-155);
push @P1, tx(180,$PH-78,"F2",36,"1 1 1","SwellLine");
push @P1, tx(196,$PH-108,"F1",14,"0.88 0.95 0.98","Guia do Utilizador");
# mini-gráfico bull na capa
push @P1, "0.85 0.85 0.85 RG 0.8 w 118 368 300 210 re S\n";
my $cy0=352; my $csc=2.5;
for my $i (0..8){ my($o,$c,$l,$h)=@{$CY[$i]}; candle(\@P1,140+$i*24,$o,$c,$l,$h,$cy0,$csc); }
pline(\@P1,$LIME,2.5, 126,$cy0+20*$csc, 182,$cy0+20*$csc, 182,$cy0+26*$csc, 230,$cy0+26*$csc, 230,$cy0+34*$csc, 278,$cy0+34*$csc, 278,$cy0+44*$csc, 326,$cy0+44*$csc, 326,$cy0+56*$csc, 356,$cy0+56*$csc);
lbox(\@P1,126,$cy0+12*$csc,44,13,$GREEN,"bullish",8);
push @P1, tx(140,340,"F1",12,$DARK,"Indicador de tendência para TradingView");
push @P1, tx(128,320,"F1",12,$DARK,"Foco no longo prazo - simples, mecânico, disciplinado");
push @P1, sprintf("%s RG 1.2 w 96 236 400 40 re S\n",$TEAL);
push @P1, tx(112,252,"F2",12.5,$TEAL,"O essencial: linha VERDE = dentro · linha VERMELHA = fora");
push @P1, tx(250,90,"F1",9,$GRAY,"v1.0 · Julho 2026");

# ================= PÁGINA 2 — ÍNDICE =================
my @P2; header(\@P2,"Índice"); footer(\@P2,2);
my @IDX=(
 ["1. O que é a SwellLine",3],
 ["2. Ler a linha: verde e vermelho",3],
 ["3. O Flip Level: o teu stop automático",4],
 ["4. A tabela de confirmação (ALIGNED / CONFLICT)",5],
 ["5. A faixa de força (momentum)",5],
 ["6. Avisos de topos e fundos",6],
 ["7. Como usar, passo a passo",7],
 ["8. Boas práticas e erros a evitar",7]);
my $iy=720;
for my $e (@IDX){
  my($lab,$pg)=@$e;
  push @P2, tx($LEFT+14,$iy,"F1",11.5,$DARK,$lab);
  my $x1=$LEFT+14+length($lab)*5.8+8;
  dashln(\@P2,"0.7 0.7 0.7",$x1,$iy+3,498,$iy+3);
  push @P2, tx(508,$iy,"F2",11.5,$TEAL,"$pg");
  $iy-=30;
}
push @P2, tx($LEFT+14,$iy-14,"F1",10,$GRAY,"Dica: se tens pressa, lê só as páginas 3 e 7 - já ficas operacional.");

# ================= PÁGINA 3 =================
my @P3; header(\@P3,"SwellLine"); footer(\@P3,3);
hd(\@P3,760,"1. O que é a SwellLine");
my $y=paraAt(\@P3,740,10.5,$DARK,"A SwellLine é um indicador de tendência para o TradingView. Responde a uma única pergunta: devo estar DENTRO ou FORA deste ativo? Uma linha acompanha o preço, adapta-se à volatilidade e muda de cor quando a tendência de fundo vira.");
hd(\@P3,$y-8,"2. Ler a linha: verde e vermelho");
paraAt(\@P3,$y-26,10.5,$DARK,"O esquema abaixo mostra um ciclo completo: subida, viragem, descida e nova subida.");
# gráfico grande
push @P3, "0.85 0.85 0.85 RG 0.8 w 62 432 468 226 re S\n";
my $g0=425; my $gs=2.3;
for my $i (0..17){ my($o,$c,$l,$h)=@{$CY[$i]}; candle(\@P3,84+$i*24,$o,$c,$l,$h,$g0,$gs); }
pline(\@P3,$LIME,2.5, 70,$g0+20*$gs, 126,$g0+20*$gs, 126,$g0+26*$gs, 174,$g0+26*$gs, 174,$g0+34*$gs, 222,$g0+34*$gs, 222,$g0+44*$gs, 270,$g0+44*$gs, 270,$g0+56*$gs, 318,$g0+56*$gs);
pline(\@P3,$RED,2.5, 318,$g0+84*$gs, 342,$g0+84*$gs, 342,$g0+64*$gs, 366,$g0+64*$gs, 366,$g0+58*$gs, 390,$g0+58*$gs, 390,$g0+52*$gs, 462,$g0+52*$gs);
pline(\@P3,$LIME,2.5, 462,$g0+38*$gs, 522,$g0+38*$gs);
lbox(\@P3,294,$g0+81*$gs,48,13,$RED,"bearish",8);
lbox(\@P3,440,$g0+27*$gs,44,13,$GREEN,"bullish",8);
numc(\@P3,150,$g0+16*$gs,1);
numc(\@P3,352,$g0+86*$gs,2);
numc(\@P3,426,$g0+45*$gs,3);
numc(\@P3,498,$g0+30*$gs,4);
# legenda
my $ly=408;
my @LEG=(
 "Linha VERDE por baixo do preço = tendência de subida: comprar / manter.",
 "Fecho abaixo da linha = flip 'bearish': sair / ficar de fora.",
 "Linha VERMELHA por cima do preço = tendência de descida: fora do mercado.",
 "Fecho acima da linha = flip 'bullish': começa uma nova fase de compra.");
for my $i (0..3){
  numc(\@P3,$LEFT+8,$ly+3,$i+1);
  push @P3, tx($LEFT+24,$ly,"F1",10.5,$DARK,$LEG[$i]);
  $ly-=20;
}
paraAt(\@P3,$ly-8,10.5,$GRAY,"Nota: a mudança de cor só conta no FECHO da vela. No semanal, isso significa o fecho de domingo.");

# ================= PÁGINA 4 =================
my @P4; header(\@P4,"SwellLine"); footer(\@P4,4);
hd(\@P4,760,"3. O Flip Level: o teu stop automático");
$y=paraAt(\@P4,740,10.5,$DARK,"O Flip Level é o valor exato onde a tendência vira - está sempre visível no gráfico e na tabela ('Next Flip'). Funciona como stop automático: enquanto o preço não FECHAR do outro lado da linha, a tendência mantém-se. Numa subida, a linha sobe sozinha atrás do preço e nunca desce: vai trancando lucro por ti.");
# gráfico bull com entrada/stop/saída
push @P4, "0.85 0.85 0.85 RG 0.8 w 62 455 300 172 re S\n";
my $h0=440; my $hs=2.0;
for my $i (0..10){ my($o,$c,$l,$h)=@{$CY[$i]}; candle(\@P4,84+$i*24,$o,$c,$l,$h,$h0,$hs); }
pline(\@P4,$LIME,2.5, 70,$h0+20*$hs, 126,$h0+20*$hs, 126,$h0+26*$hs, 174,$h0+26*$hs, 174,$h0+34*$hs, 222,$h0+34*$hs, 222,$h0+44*$hs, 270,$h0+44*$hs, 270,$h0+56*$hs, 318,$h0+56*$hs);
lbox(\@P4,74,462,58,13,$GREEN,"ENTRADA",8);
lbox(\@P4,296,$h0+80*$hs,46,13,$RED,"SAÍDA",8);
push @P4, tx(150,468,"F1",9,$GRAY,"o stop sobe sozinho ->");
# notas à direita do gráfico
push @P4, tx(380,590,"F2",10.5,$TEAL,"Como se lê:");
push @P4, tx(380,570,"F1",10,$DARK,"1. Entras no flip bullish.");
push @P4, tx(380,552,"F1",10,$DARK,"2. O stop (a linha) sobe");
push @P4, tx(380,538,"F1",10,$DARK,"    atrás do preço.");
push @P4, tx(380,520,"F1",10,$DARK,"3. Fecho abaixo da linha");
push @P4, tx(380,506,"F1",10,$DARK,"    = saída, sem discutir.");
# exemplo numérico
push @P4, tx($LEFT,428,"F2",11.5,$DARK,"Exemplo com números (BTC semanal):");
my @EX=(
 "Compras no flip a 60.000 -> stop inicial: 52.000",
 "O preço sobe para 80.000 -> o stop já subiu para 68.000 (lucro protegido)",
 "O preço sobe para 100.000 -> stop nos 85.000",
 "Uma semana fecha abaixo de 85.000 -> sais com lucro, sem adivinhar o topo");
my $ey=406;
for my $e (@EX){ circ(\@P4,$LEFT+5,$ey+3,3,$TEAL); push @P4, tx($LEFT+18,$ey,"F1",10.5,$DARK,$e); $ey-=19; }
push @P4, sprintf("0.99 0.95 0.80 rg %.1f %.1f 483 30 re f\n",$LEFT,$ey-24);
push @P4, sprintf("%s RG 1 w %.1f %.1f 483 30 re S\n",$AMBER,$LEFT,$ey-24);
push @P4, tx($LEFT+10,$ey-13,"F2",10,$DARK,"Importante: conta o FECHO da vela, não o toque. Um pavio a furar a linha não é stop.");

# ================= PÁGINA 5 =================
my @P5; header(\@P5,"SwellLine"); footer(\@P5,5);
hd(\@P5,760,"4. A tabela de confirmação (ALIGNED / CONFLICT)");
$y=paraAt(\@P5,740,10.5,$DARK,"No canto inferior esquerdo do gráfico vive a tabela de estado. Ela compara dois 'relógios': o Weekly (a tendência de fundo) e o Daily (o movimento recente). O que interessa é a última linha - o Estado:");
# duas mini-tabelas
my @TA=(["Trend","BULLISH",$GREEN],["Weekly","BULLISH",$GREEN],["Daily","BULLISH",$GREEN],["Estado","ALIGNED BULL",$GREEN]);
my @TB=(["Trend","BEARISH",$RED],["Weekly","BEARISH",$RED],["Daily","BULLISH",$GREEN],["Estado","CONFLICT",$AMBER]);
my $ty=$y-16;
for my $r (0..3){
  my($k,$v,$c)=@{$TA[$r]};
  push @P5, sprintf("0.13 0.15 0.18 rg 70 %.1f 190 17 re f\n",$ty-$r*18);
  push @P5, tx(76,$ty-$r*18+5,"F1",9.5,"1 1 1",$k);
  push @P5, tx(160,$ty-$r*18+5,"F2",9.5,$c,$v);
  ($k,$v,$c)=@{$TB[$r]};
  push @P5, sprintf("0.13 0.15 0.18 rg 300 %.1f 190 17 re f\n",$ty-$r*18);
  push @P5, tx(306,$ty-$r*18+5,"F1",9.5,"1 1 1",$k);
  push @P5, tx(390,$ty-$r*18+5,"F2",9.5,$c,$v);
}
push @P5, tx(70,$ty-4*18-12,"F2",10.5,$GREEN,"-> pode agir");
push @P5, tx(300,$ty-4*18-12,"F2",10.5,$AMBER,"-> ESPERAR, não fazer nada");
my $ry=$ty-4*18-40;
push @P5, tx($LEFT,$ry,"F2",11.5,$TEAL,"Regra de ouro: só se age quando está ALIGNED. Em CONFLICT, mãos quietas.");
hd(\@P5,$ry-30,"5. A faixa de força (momentum)");
$y=paraAt(\@P5,$ry-50,10.5,$DARK,"É a barra de cores no fundo do gráfico. Mede a força (momentum) do movimento e reage ANTES da linha principal:");
# barra gradiente
my $bx=90; my $by=$y-26;
for my $j (0..17){
  my $t=$j/17; my($r,$g,$b);
  if($t<0.5){ my $u=$t/0.5; $r=0.47+(0.98-0.47)*$u; $g=0.00+(0.85-0.00)*$u; $b=0.00+(0.10-0.00)*$u; }
  else { my $u=($t-0.5)/0.5; $r=0.98+(0.05-0.98)*$u; $g=0.85+(0.70-0.85)*$u; $b=0.10+(0.15-0.10)*$u; }
  push @P5, sprintf("%.2f %.2f %.2f rg %.1f %.1f 20 16 re f\n",$r,$g,$b,$bx+$j*20,$by);
}
push @P5, tx(90,$by-16,"F1",9.5,$DARK,"vendedores fortes");
push @P5, tx(240,$by-16,"F1",9.5,$DARK,"transição");
push @P5, tx(360,$by-16,"F1",9.5,$DARK,"compradores fortes");
paraAt(\@P5,$by-40,10.5,$DARK,"Exemplo: em pleno bear, a faixa aquece de vermelho para amarelo - a maré pode estar a virar. É um aviso; o gatilho continua a ser o flip.");

# ================= PÁGINA 6 =================
my @P6; header(\@P6,"SwellLine"); footer(\@P6,6);
hd(\@P6,760,"6. Avisos de topos e fundos");
$y=paraAt(\@P6,740,10.5,$DARK,"Sinais 'líderes' que costumam aparecer ANTES da viragem. Usa-os como contexto para te preparares - nunca como ordem de entrada.");
my $sy=$y-14;
# itens com símbolos
circ(\@P6,$LEFT+8,$sy+3,4,$LIME);
$sy=paraAt(\@P6,$sy,10,$DARK,"      Ponto verde por baixo de uma vela: possível FUNDO - o Daily virou para cima durante um bear.")-4;
circ(\@P6,$LEFT+8,$sy+3,4,$RED);
$sy=paraAt(\@P6,$sy,10,$DARK,"      Ponto vermelho por cima de uma vela: possível TOPO - o Daily virou para baixo durante um bull.")-4;
lbox(\@P6,$LEFT,$sy-2,42,12,$TEALC,"fundo?",7.5);
$sy=paraAt(\@P6,$sy,10,$DARK,"           Divergência de fundo: o preço faz novo mínimo, mas a força já não acompanha.")-4;
lbox(\@P6,$LEFT,$sy-2,38,12,$MAROON,"topo?",7.5);
$sy=paraAt(\@P6,$sy,10,$DARK,"           Divergência de topo: novo máximo com a força a esgotar-se.")-4;
diam(\@P6,$LEFT+8,$sy+3,5,$AMBER);
$sy=paraAt(\@P6,$sy,10,$DARK,"      Losango laranja: exaustão - o preço está esticado demais. Zona de realizar lucros, não de entrar.")-4;
pline(\@P6,"0.55 0.55 0.55",2.5,$LEFT,$sy+3,$LEFT+18,$sy+3);
$sy=paraAt(\@P6,$sy,10,$DARK,"      200W MA (linha branca no gráfico): preço abaixo dela = zona historicamente 'barata' - o fundo do gráfico pinta-se de verde.")-8;
push @P6, tx($LEFT,$sy,"F2",11,$DARK,"Sequência típica de um fundo (esquema):");
# mini-gráfico de fundo
my @BOT=([80,72,68,84],[72,62,58,74],[62,52,47,64],[52,42,36,54],[42,34,28,44],[34,40,30,43],[40,50,38,53],[50,58,46,62]);
push @P6, "0.85 0.85 0.85 RG 0.8 w 62 300 300 200 re S\n";
my $b0=292; my $bs=2.1;
for my $i (0..7){ my($o,$c,$l,$h)=@{$BOT[$i]}; candle(\@P6,100+$i*24,$o,$c,$l,$h,$b0,$bs); }
pline(\@P6,$RED,2.5, 88,$b0+92*$bs, 136,$b0+92*$bs, 136,$b0+74*$bs, 184,$b0+74*$bs, 184,$b0+62*$bs, 232,$b0+62*$bs, 232,$b0+56*$bs, 292,$b0+56*$bs);
pline(\@P6,$LIME,2.5, 268,$b0+42*$bs, 340,$b0+42*$bs);
circ(\@P6,196,$b0+24*$bs,4,$LIME);
lbox(\@P6,164,$b0+13*$bs,44,12,$TEALC,"fundo?",7.5);
lbox(\@P6,246,$b0+26*$bs,44,12,$GREEN,"bullish",7.5);
push @P6, tx(380,470,"F2",10,$TEAL,"1. Queda esticada (exaustão)");
push @P6, tx(380,440,"F2",10,$TEAL,"2. Ponto verde: o Daily virou");
push @P6, tx(380,410,"F2",10,$TEAL,"3. 'fundo?': a força diverge");
push @P6, tx(380,380,"F2",10,$TEAL,"4. Flip bullish = entrada");
push @P6, sprintf("0.90 0.96 0.90 rg %.1f 252 483 30 re f\n",$LEFT);
push @P6, sprintf("%s RG 1 w %.1f 252 483 30 re S\n",$GREEN,$LEFT);
push @P6, tx($LEFT+10,263,"F2",10,$DARK,"Os avisos preparam-te. A ENTRADA é sempre no flip, com o Estado ALIGNED.");

# ================= PÁGINA 7 =================
my @P7; header(\@P7,"SwellLine"); footer(\@P7,7);
hd(\@P7,760,"7. Como usar, passo a passo");
my @ST=(
 "Abre o gráfico no Weekly (semanal).",
 "Olha a cor da linha: verde = podes estar dentro; vermelho = fora.",
 "Espera pelo flip (mudança de cor) confirmado no FECHO da vela.",
 "Confirma na tabela: só entras se o Estado estiver ALIGNED.",
 "Coloca o stop no Flip Level e deixa-o subir sozinho.",
 "Sai quando a linha virar de cor - ou realiza parte nos avisos de topo.");
my $py=736;
for my $i (0..5){ numc(\@P7,$LEFT+8,$py+3,$i+1); push @P7, tx($LEFT+24,$py,"F1",10.5,$DARK,$ST[$i]); $py-=21; }
hd(\@P7,$py-14,"8. Boas práticas e erros a evitar");
my $gy=$py-36;
push @P7, tx($LEFT,$gy,"F2",11,$GREEN,"Boas práticas"); $gy-=19;
for my $t ("Usa o Weekly para decidir e o Daily para afinar o timing.",
           "Ativa os alertas (ex.: 'FLIP sem conflito') e deixa o gráfico em paz.",
           "Poucos sinais por ano é normal - é essa a vantagem."){
  circ(\@P7,$LEFT+5,$gy+3,3,$GREEN); push @P7, tx($LEFT+18,$gy,"F1",10.5,$DARK,$t); $gy-=18; }
$gy-=8;
push @P7, tx($LEFT,$gy,"F2",11,$RED,"Erros a evitar"); $gy-=19;
for my $t ("Ignorar o CONFLICT e entrar na mesma.",
           "Usar alavancagem alta: a liquidação chega antes do stop do indicador.",
           "Procurar sinais em 15m/1h - é ruído, não é tendência.",
           "Sair no susto de um pavio: só o FECHO da vela conta."){
  circ(\@P7,$LEFT+5,$gy+3,3,$RED); push @P7, tx($LEFT+18,$gy,"F1",10.5,$DARK,$t); $gy-=18; }
$gy-=14;
push @P7, sprintf("0.99 0.95 0.80 rg %.1f %.1f 483 42 re f\n",$LEFT,$gy-30);
push @P7, sprintf("%s RG 1 w %.1f %.1f 483 42 re S\n",$AMBER,$LEFT,$gy-30);
push @P7, tx($LEFT+10,$gy-6,"F2",9.5,$DARK,"Este guia é apenas educativo e não constitui aconselhamento financeiro.");
push @P7, tx($LEFT+10,$gy-21,"F2",9.5,$DARK,"Gere o risco: stop sempre, posição pequena, sem alavancagem alta.");
push @P7, tx($LEFT+30,$gy-70,"F2",12.5,$TEAL,"A SwellLine não adivinha o mercado -");
push @P7, tx($LEFT+30,$gy-88,"F2",12.5,$TEAL,"mantém-te do lado certo dele.");

# ================= MONTAGEM =================
my @PAGES=(\@P1,\@P2,\@P3,\@P4,\@P5,\@P6,\@P7);
my $NP=scalar @PAGES;
my @objs;
$objs[1]="<< /Type /Catalog /Pages 2 0 R >>";
my @kids; push @kids, (3+$_)." 0 R" for (0..$NP-1);
$objs[2]="<< /Type /Pages /Kids [".join(" ",@kids)."] /Count $NP >>";
my $fnt1=3+2*$NP; my $fnt2=$fnt1+1;
my $res="<< /Font << /F1 $fnt1 0 R /F2 $fnt2 0 R >> >>";
for my $i (0..$NP-1){
  my $cobj=3+$NP+$i;
  $objs[3+$i]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 $PW $PH] /Resources $res /Contents $cobj 0 R >>";
  my $c=join("",@{$PAGES[$i]});
  $objs[$cobj]="<< /Length ".length($c)." >>\nstream\n$c"."endstream";
}
$objs[$fnt1]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
$objs[$fnt2]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

my $NOBJ=$fnt2;
my $out="%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
my @off;
for my $n (1..$NOBJ){ $off[$n]=length($out); $out.="$n 0 obj\n$objs[$n]\nendobj\n"; }
my $xref=length($out);
$out.="xref\n0 ".($NOBJ+1)."\n0000000000 65535 f \n";
for my $n (1..$NOBJ){ $out.=sprintf("%010d 00000 n \n",$off[$n]); }
$out.="trailer\n<< /Size ".($NOBJ+1)." /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n";

open(my $fh,">:raw",$ARGV[0]) or die "open: $!";
print $fh $out; close($fh);
print "PDF OK: ",length($out)," bytes, $NP páginas -> $ARGV[0]\n";
