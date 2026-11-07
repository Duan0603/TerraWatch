"""Generate presentation figures from the saved experimental metrics."""
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

HERE = Path(__file__).resolve().parent
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11,
                     'svg.fonttype': 'none', 'figure.facecolor': '#f7f9fc'})
NAVY, BLUE, GREEN, ORANGE = '#15324e', '#dceafe', '#d9f0e5', '#fff0d9'


def base(title, subtitle, height=7):
    fig, ax = plt.subplots(figsize=(14, height))
    ax.set(xlim=(0, 14), ylim=(0, height))
    ax.axis('off')
    ax.text(.25, height-.4, title, size=21, weight='bold', color=NAVY)
    ax.text(.25, height-.8, subtitle, size=11, color='#54677d')
    return fig, ax


def box(ax, x, y, w, h, text, color=BLUE):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0.09,rounding_size=0.12',
                              linewidth=1, edgecolor='#aebed1', facecolor=color))
    ax.text(x+w/2, y+h/2, text, ha='center', va='center', color=NAVY, linespacing=1.5)


def arrow(ax, start, end):
    ax.add_patch(FancyArrowPatch(start, end, arrowstyle='-|>', mutation_scale=17,
                                linewidth=1.5, color='#526d88'))


def save(fig, name):
    for ext in ('png', 'svg'):
        fig.savefig(HERE / f'{name}.{ext}', dpi=160, bbox_inches='tight', facecolor=fig.get_facecolor())
    plt.close(fig)


def main():
    fig, ax = base('TERRAWATCH | Two-branch landslide research model',
                   '1 km output grid | 168h rainfall history + 24h forecast | uncalibrated research score')
    box(ax, .3, 4.1, 2.3, 1.1, 'IMERG rainfall\n168 hourly values')
    box(ax, 3.0, 4.1, 2.4, 1.1, 'log1p + train scaling\n24 steps x 7 hours')
    box(ax, 5.9, 4.1, 2.0, 1.1, 'GRU\nhidden state: 24')
    box(ax, 5.9, 2.45, 2.0, 1.0, 'Rain summaries\n24h / 72h / 168h\npeak 1h + GFS 24h')
    box(ax, 8.45, 3.7, 2.3, 1.4, 'Concatenate: 29\nDense 16 + ReLU\nDense 1 + sigmoid')
    box(ax, 11.3, 3.9, 2.1, 1.0, 'Temporal score', GREEN)
    for a,b in [((2.7,4.65),(2.9,4.65)),((5.5,4.65),(5.8,4.65)),
                ((8,4.65),(8.35,4.65)),((8,2.95),(9.6,3.6)),((10.85,4.4),(11.2,4.4))]:
        arrow(ax,a,b)
    box(ax,.3,.95,3.4,1.15,'Slope + clay + sand\n+ bulk density',GREEN)
    box(ax,4.3,.95,3.5,1.15,'Train scaling\nL2 Logistic Regression',GREEN)
    box(ax,8.4,.95,2.35,1.15,'Spatial score',GREEN)
    box(ax,11.3,.95,2.1,1.15,'Multiply\nhazard score',ORANGE)
    for a,b in [((3.8,1.52),(4.2,1.52)),((7.9,1.52),(8.3,1.52)),
                ((10.85,1.52),(11.2,1.52)),((12.35,3.8),(12.35,2.2))]:arrow(ax,a,b)
    ax.text(.3,.25,'Research demo: score is not a calibrated probability; no operational alert claim.',color='#8a4821')
    save(fig,'architecture')

    fig,ax=base('MIL | Learn from an uncertain event interval',
                 'Positive bag assumption: at least one candidate day is positive; the true day remains unverified',6)
    for i,t in enumerate(['Day 1','Day 2','Day 3']):
        x=.6+i*3.0
        box(ax,x,3.3,2.4,.95,t+'\n168h history + GFS')
        box(ax,x,1.95,2.4,.85,'Same GRU\ndaily score',GREEN)
        arrow(ax,(x+1.2,3.2),(x+1.2,2.9))
        ax.plot([x+1.2,x+1.2],[1.85,1.3],color='#526d88',linewidth=1.5)
    ax.plot([1.8,9.8],[1.3,1.3],color='#526d88',linewidth=1.5)
    arrow(ax,(9.8,1.3),(10.3,2.1))
    box(ax,10.4,1.65,2.7,1.2,'Max over daily scores\nBag score',ORANGE)
    ax.text(10.4,.85,'Weighted BCE vs bag label',color=NAVY,ha='left')
    arrow(ax,(11.75,1.55),(11.75,1.12))
    ax.text(.4,.25,'MIL avoids assigning a fabricated single day; it does not verify event dates or background absence.',color='#8a4821')
    save(fig,'mil')

    metrics=json.loads((HERE.parent/'outputs/metrics.json').read_text(encoding='utf8'))['slope_plus_soil_model']
    keys=['test_overall_at_sensitive','test_overall_at_balanced_050','test_overall_at_conservative_065']
    fig,axes=plt.subplots(1,2,figsize=(14,5.7),gridspec_kw={'width_ratios':[1.3,1]})
    fig.suptitle('Experimental test results | spatial soil + temporal GRU MIL',size=19,weight='bold',color=NAVY,y=.98)
    ax=axes[0]; x=list(range(3)); width=.24
    for j,(field,color) in enumerate([('recall','#2b73c5'),('precision','#27815d'),('f1','#d58126')]):
        vals=[metrics[k][field] for k in keys]
        bars=ax.bar([a+(j-1)*width for a in x],vals,width,label=field.capitalize(),color=color)
        ax.bar_label(bars,labels=[f'{v:.3f}' for v in vals],fontsize=9,padding=3)
    ax.set_xticks(x,['Threshold 0.26','Threshold 0.50','Threshold 0.65'])
    ax.set_ylim(0,1.15);ax.set_ylabel('Metric against proxy labels');ax.legend(loc='upper right')
    ax.set_title('2,521 test rows | 346 positive proxy rows',pad=15)
    ax.spines[['top','right']].set_visible(False)
    ax=axes[1];m=metrics[keys[1]]
    data=[[m['tn'],m['fp']],[m['fn'],m['tp']]]
    ax.imshow(data,cmap='Blues')
    for i in range(2):
        for j in range(2):ax.text(j,i,str(data[i][j]),ha='center',va='center',size=23,color='white' if data[i][j]>900 else NAVY)
    ax.set_xticks([0,1],['Predicted 0','Predicted 1']);ax.set_yticks([0,1],['Proxy 0','Proxy 1'])
    ax.set_title('Confusion matrix | threshold 0.50',pad=15)
    fig.text(.06,.025,'Limited historical event sample; proxy labels. These metrics do not establish operational 24h forecasting skill.',color='#8a4821')
    fig.tight_layout(rect=(0,.07,1,.91))
    save(fig,'results')


if __name__=='__main__':main()
