use strict; use warnings; use utf8; use Encode;

my $PW=595.28; my $PH=841.89;
my $LEFT=56; my $RIGHT=539; my $CW=$RIGHT-$LEFT;

sub esc { my $s=shift; my $b=Encode::encode('cp1252',$s,Encode::FB_DEFAULT);
  $b =~ s/([\()])/\$1/g; return $b; }
sub tx { my($x,$y,$f,$sz,$c,$s)=@_; return sprintf("BT /%s %s Tf %s rg %.2f %.2f Td (%s) Tj ET\n",$f,$sz,$c,$x,$y,esc($s)); }
sub wrap { my($t,$sz,$mw)=@_; my @w=split /\s+/,$t; my @ln; my $cur=""; my $cwf=$sz*0.50;
  for my $word (@w){ my $try=($cur eq "")?$word:"$cur $word"; if(length($try)*$cwf>$mw){ push @ln,$cur if $cur ne ""; $cur=$word;} else {$cur=$try;} }
  push @ln,$cur if $cur ne ""; return @ln; }

my $DARK="0.16 0.18 0.21"; my $TEAL="0.07 0.40 0.60"; my $GREEN="0.10 0.62 0.22";
my $LGREEN="0.45 0.72 0.30"; my $RED="0.82 0.16 0.16"; my $AMBER="0.92 0.66 0.10"; my $GRAY="0.45 0.45 0.45";

my @P1; my @P2; my $y1; my $y2;

sub heading { my($buf,$yref,$t)=@_; $$yref-=4; push @$buf, tx($LEFT,$$yref,"F2",13,$TEAL,$t); $$yref-=19; }
sub para { my($buf,$yref,$t)=@_; for my $l (wrap($t,10.5,$CW)){ push @$buf, tx($LEFT,$$yref,"F1",10.5,$DARK,$l); $$yref-=14.2; } $$yref-=6; }
sub bullet { my($buf,$yref,$col,$t)=@_; my @l=wrap($t,10.5,$CW-20);
  push @$buf, sprintf("%s rg %.2f %.2f 6 6 re f\n",$col,$LEFT+2,$$yref+1);
  push @$buf, tx($LEFT+18,$$yref,"F1",10.5,$DARK,$l[0]); $$yref-=14.2;
  for my $i (1..$#l){ push @$buf, tx($LEFT+18,$$yref,"F1",10.5,$DARK,$l[$i]); $$yref-=14.2; } $$yref-=3; }
sub step { my($buf,$yref,$n,$t)=@_; my @l=wrap($t,10.5,$CW-22);
  push @$buf, tx($LEFT,$$yref,"F2",10.5,$TEAL,"$n.");
  push @$buf, tx($LEFT+20,$$yref,"F1",10.5,$DARK,$l[0]); $$yref-=14.2;
  for my $i (1..$#l){ push @$buf, tx($LEFT+20,$$yref,"F1",10.5,$DARK,$l[$i]); $$yref-=14.2; } $$yref-=3; }

# ---------- PAGE 1 ----------
push @P1, sprintf("%s rg 0 %.2f %.2f 80 re f\n",$TEAL,$PH-80,$PW);
push @P1, sprintf("1 1 1 RG 1.6 w 0 %.2f m 99 %.2f 198 %.2f 297 %.2f c 396 %.2f 495 %.2f 595 %.2f c S\n",
  $PH-72,$PH-58,$PH-86,$PH-72,$PH-58,$PH-86,$PH-72);
push @P1, tx($LEFT,$PH-46,"F2",28,"1 1 1","SwellLine");
push @P1, tx($LEFT,$PH-68,"F1",11.5,"0.88 0.95 0.98","Indicador de Tend\x{ea}ncia  -  Foco no Longo Prazo");

$y1=$PH-118;
heading(\@P1,\$y1,"A ideia em poucas palavras");
para(\@P1,\$y1,"A SwellLine mostra a direc\x{e7}\x{e3}o da tend\x{ea}ncia de fundo. O objetivo \x{e9} simples: ficar do lado da tend\x{ea}ncia enquanto ela dura, e sair quando ela vira. Foi pensada para o longo prazo - brilha no gr\x{e1}fico semanal (Weekly).");

heading(\@P1,\$y1,"Ler a linha (o mais importante)");
bullet(\@P1,\$y1,$GREEN,"Linha VERDE por baixo do pre\x{e7}o = tend\x{ea}ncia de subida (bull). Fase de comprar ou manter posi\x{e7}\x{e3}o.");
bullet(\@P1,\$y1,$RED,"Linha VERMELHA por cima do pre\x{e7}o = tend\x{ea}ncia de descida (bear). Fase de vender ou ficar de fora.");
para(\@P1,\$y1,"Quando a cor muda, surge a etiqueta 'bullish' ou 'bearish'. Esse \x{e9} o sinal de viragem da tend\x{ea}ncia.");

heading(\@P1,\$y1,"O Flip Level");
para(\@P1,\$y1,"\x{c9} o pre\x{e7}o exato onde a tend\x{ea}ncia vira. Em bull funciona como suporte; em bear como resist\x{ea}ncia. Serve tamb\x{e9}m de stop natural: se o pre\x{e7}o fechar do outro lado da linha, a tend\x{ea}ncia mudou.");

heading(\@P1,\$y1,"Confirma\x{e7}\x{e3}o - a tabela (canto inferior esquerdo)");
para(\@P1,\$y1,"A tabela mostra a tend\x{ea}ncia no Weekly e no Daily ao mesmo tempo:");
bullet(\@P1,\$y1,$GREEN,"ALIGNED BULL - ambos a subir: sinal forte de compra.");
bullet(\@P1,\$y1,$RED,"ALIGNED BEAR - ambos a descer: ficar fora do mercado.");
bullet(\@P1,\$y1,$AMBER,"CONFLICT - discordam entre si: esperar, n\x{e3}o agir.");
para(\@P1,\$y1,"Regra de ouro: s\x{f3} agir quando est\x{e3}o ALIGNED. Evitar operar em CONFLICT.");

heading(\@P1,\$y1,"A faixa de for\x{e7}a (heatmap no fundo)");
para(\@P1,\$y1,"Mede o momentum (a for\x{e7}a do movimento). Verde = for\x{e7}a compradora, vermelho = vendedora, amarelo = transi\x{e7}\x{e3}o. Serve de aviso pr\x{e9}vio quando a mar\x{e9} come\x{e7}a a virar.");

# ---------- PAGE 2 ----------
push @P2, sprintf("%s rg 0 %.2f %.2f 46 re f\n",$TEAL,$PH-46,$PW);
push @P2, tx($LEFT,$PH-31,"F2",16,"1 1 1","SwellLine  -  Guia r\x{e1}pido");

$y2=$PH-84;
heading(\@P2,\$y2,"Foco no longo prazo: em que timeframe usar");
para(\@P2,\$y2,"Este \x{e9} um indicador de tend\x{ea}ncia de longo prazo. \x{c9} no Weekly que \x{e9} mais fi\x{e1}vel: d\x{e1} poucos sinais por ano, mas cada um tem peso e capta os grandes movimentos, evitando o ru\x{ed}do do curto prazo.");
bullet(\@P2,\$y2,$GREEN,"Weekly (semanal) - IDEAL. O sinal principal. Poucos sinais, muito fi\x{e1}veis.");
bullet(\@P2,\$y2,$LGREEN,"Daily (di\x{e1}rio) - bom para confirma\x{e7}\x{e3}o e timing de entrada e sa\x{ed}da.");
bullet(\@P2,\$y2,$AMBER,"4h / 1h - ruidoso, muitos sinais falsos. Usar s\x{f3} como contexto.");
bullet(\@P2,\$y2,$RED,"15m ou menos - evitar. O ru\x{ed}do domina.");

heading(\@P2,\$y2,"Como usar - passo a passo");
step(\@P2,\$y2,1,"Abre o gr\x{e1}fico no Weekly (semanal).");
step(\@P2,\$y2,2,"Espera por um flip - a linha muda de cor.");
step(\@P2,\$y2,3,"Confirma na tabela: s\x{f3} entra se estiver ALIGNED.");
step(\@P2,\$y2,4,"Entrada na direc\x{e7}\x{e3}o da linha (verde = comprar).");
step(\@P2,\$y2,5,"Stop no Flip Level (se o pre\x{e7}o fechar do outro lado, sais).");
step(\@P2,\$y2,6,"Sa\x{ed}da quando a linha vira de cor - ou nos alvos de ATR.");

heading(\@P2,\$y2,"Para ter sempre em mente");
para(\@P2,\$y2,"A SwellLine segue a tend\x{ea}ncia, n\x{e3}o a adivinha - reage a ela. Em mercado lateral (sem tend\x{ea}ncia) d\x{e1} mais sinais falsos. Paci\x{ea}ncia: no longo prazo, poucos sinais bons valem mais que muitos sinais apressados.");

push @P2, sprintf("%s RG 0.6 w %.2f 70 m %.2f 70 l S\n",$GRAY,$LEFT,$RIGHT);
push @P2, tx($LEFT,58,"F1",8.5,$GRAY,"Material apenas educativo. N\x{e3}o constitui aconselhamento financeiro. Gere sempre o risco e usa stop.");
push @P2, tx($LEFT,46,"F1",8.5,$GRAY,"SwellLine - indicador de tend\x{ea}ncia.");

# ---------- assemble ----------
my $c1=join("",@P1); my $c2=join("",@P2);
my @objs;
$objs[1]="<< /Type /Catalog /Pages 2 0 R >>";
$objs[2]="<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>";
my $res="<< /Font << /F1 7 0 R /F2 8 0 R >> >>";
$objs[3]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 $PW $PH] /Resources $res /Contents 5 0 R >>";
$objs[4]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 $PW $PH] /Resources $res /Contents 6 0 R >>";
$objs[5]="<< /Length ".length($c1)." >>\nstream\n$c1"."endstream";
$objs[6]="<< /Length ".length($c2)." >>\nstream\n$c2"."endstream";
$objs[7]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
$objs[8]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

my $out="%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
my @off;
for my $n (1..8){ $off[$n]=length($out); $out.="$n 0 obj\n$objs[$n]\nendobj\n"; }
my $xref=length($out);
$out.="xref\n0 9\n0000000000 65535 f \n";
for my $n (1..8){ $out.=sprintf("%010d 00000 n \n",$off[$n]); }
$out.="trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n";

open(my $fh,">:raw",$ARGV[0]) or die "open: $!";
print $fh $out; close($fh);
print "PDF OK: ",length($out)," bytes -> $ARGV[0]\n";
