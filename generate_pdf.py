#!/usr/bin/env python3
"""PDF generator — Natural Ice Abu Dhabi Warehouse Tracker (styled v3)."""
import json, sys
from fpdf import FPDF, XPos, YPos

def safe(text):
    return (
        str(text)
        .replace('\u2014', '-').replace('\u2013', '-')
        .replace('\u2018', "'").replace('\u2019', "'")
        .replace('\u201c', '"').replace('\u201d', '"')
        .encode('latin-1', errors='replace').decode('latin-1')
    )

payload     = json.loads(sys.stdin.read())
report_type = payload['type']
output_path = payload['output']
title       = safe(payload.get('title', 'Abu Dhabi Warehouse'))

# ── Colour palette ─────────────────────────────────────────────────────────────
NAVY        = (15,  40,  80)    # deep navy — header bg
TEAL        = (0,  130, 110)    # teal — category bars
GOLD        = (195, 140,  20)   # gold — highlights / totals
SKY         = (220, 240, 255)   # sky blue — alt rows
MINT        = (220, 248, 238)   # mint — category sub-rows
DARK_TEXT   = (20,  30,  50)    # almost-black body text
MID_TEXT    = (70,  90, 120)    # medium blue-grey
WHITE       = (255, 255, 255)
LIGHT_GOLD  = (255, 248, 220)   # light warm yellow — closing col bg
ORANGE      = (210,  95,  20)   # orange — dispatch text
GREEN_TEXT  = (0,  110,  80)    # green — received text
GRAY        = (150, 160, 170)


class WarehousePDF(FPDF):
    def normalize_text(self, text):
        return safe(text)

    # ── Header banner ──────────────────────────────────────────────────────────
    def header(self):
        # Navy banner
        self.set_fill_color(*NAVY)
        self.rect(0, 0, 210, 22, 'F')

        # Company name — white bold
        self.set_y(4)
        self.set_font('Helvetica', 'B', 15)
        self.set_text_color(*WHITE)
        self.cell(0, 7, 'NATURAL ICE  |  ABU DHABI WAREHOUSE', align='C',
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Sub-title — gold
        self.set_font('Helvetica', 'B', 8)
        self.set_text_color(*GOLD)
        lbl = {'daily': 'DAILY STOCK REPORT', 'monthly': 'MONTHLY SUMMARY REPORT',
               'yearly': 'ANNUAL OVERVIEW REPORT'}.get(report_type, 'STOCK REPORT')
        self.cell(0, 5, f'{lbl}  |  {title}', align='C',
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        self.set_y(26)

    # ── Footer ─────────────────────────────────────────────────────────────────
    def footer(self):
        self.set_y(-13)
        self.set_fill_color(*NAVY)
        self.rect(0, self.get_y() - 1, 210, 14, 'F')
        self.set_font('Helvetica', 'I', 7)
        self.set_text_color(*WHITE)
        self.cell(0, 10,
                  f'Page {self.page_no()}  |  Natural Ice — Abu Dhabi Warehouse Tracker',
                  align='C')

    # ── KPI summary box row ────────────────────────────────────────────────────
    def kpi_row(self, kpis):
        """kpis = list of (label, value, (R,G,B) accent)"""
        n = len(kpis)
        box_w = 180 / n
        x0 = self.l_margin
        y0 = self.get_y()
        h  = 14
        for label, value, accent in kpis:
            # Box bg
            self.set_fill_color(*accent)
            self.rect(x0, y0, box_w - 2, h, 'F')
            # Value
            self.set_xy(x0, y0 + 1)
            self.set_font('Helvetica', 'B', 11)
            self.set_text_color(*WHITE)
            self.cell(box_w - 2, 6, str(value), align='C')
            # Label
            self.set_xy(x0, y0 + 7)
            self.set_font('Helvetica', '', 6)
            self.cell(box_w - 2, 5, label, align='C')
            x0 += box_w
        self.set_xy(self.l_margin, y0 + h + 3)

    # ── Category header bar ────────────────────────────────────────────────────
    def cat_header(self, cat_name):
        self.set_font('Helvetica', 'B', 8)
        self.set_fill_color(*TEAL)
        self.set_text_color(*WHITE)
        self.cell(0, 7, f'   {cat_name}', fill=True,
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # ── Column header row ──────────────────────────────────────────────────────
    def col_header(self, cols, widths, colors=None):
        self.set_font('Helvetica', 'B', 7)
        self.set_fill_color(*NAVY)
        self.set_text_color(*WHITE)
        self.set_draw_color(*NAVY)
        for i, (col, w) in enumerate(zip(cols, widths)):
            self.cell(w, 6, col, border=0, fill=True, align='C')
        self.ln()
        # thin gold underline
        self.set_draw_color(*GOLD)
        self.set_line_width(0.4)
        self.line(self.l_margin, self.get_y(), self.l_margin + sum(widths), self.get_y())
        self.ln(0.2)

    # ── Data row ───────────────────────────────────────────────────────────────
    def data_row(self, values, widths, alt=False, col_styles=None):
        """col_styles: list of ('color', 'bold'?) per col. None = default."""
        bg = SKY if alt else WHITE
        self.set_fill_color(*bg)
        self.set_draw_color(200, 215, 230)
        self.set_line_width(0.15)
        for j, (val, w) in enumerate(zip(values, widths)):
            style = (col_styles[j] if col_styles else None) or {}
            font  = 'B' if style.get('bold') else ''
            color = style.get('color', DARK_TEXT)
            cell_bg = style.get('bg', bg)
            self.set_font('Helvetica', font, 6.5)
            self.set_text_color(*color)
            self.set_fill_color(*cell_bg)
            align = 'L' if j == 0 else 'C'
            self.cell(w, 5, str(val), border=1, fill=True, align=align)
        self.ln()

    # ── Total row ──────────────────────────────────────────────────────────────
    def total_row(self, values, widths):
        self.set_font('Helvetica', 'B', 7.5)
        self.set_fill_color(*GOLD)
        self.set_text_color(*NAVY)
        self.set_draw_color(*GOLD)
        for val, w in zip(values, widths):
            self.cell(w, 7, str(val), border=1, fill=True, align='C')
        self.ln()

    # ── Section spacer ─────────────────────────────────────────────────────────
    def section_gap(self, h=3):
        self.ln(h)


# ── Column style helpers ────────────────────────────────────────────────────────
def daily_col_styles(n_cols, alt):
    # [product, opening, recv_dubai, recv_umq, dispatch, closing]
    bg = SKY if alt else WHITE
    return [
        {'color': DARK_TEXT, 'bold': False, 'bg': bg},           # product
        {'color': MID_TEXT,  'bold': False, 'bg': bg},           # opening
        {'color': GREEN_TEXT,'bold': False, 'bg': MINT if alt else (235,252,245)},  # recv dubai
        {'color': GREEN_TEXT,'bold': False, 'bg': MINT if alt else (235,252,245)},  # recv umq
        {'color': ORANGE,    'bold': False, 'bg': bg},           # dispatch
        {'color': NAVY,      'bold': True,  'bg': LIGHT_GOLD},   # closing
    ]


# ══════════════════════════════════════════════════════════════════════════════
pdf = WarehousePDF()
pdf.set_auto_page_break(auto=True, margin=16)
pdf.set_margins(10, 28, 10)
pdf.add_page()

COLS   = ['PRODUCT', 'OPENING', 'RECV DUBAI', 'RECV UMQ', 'DISPATCH', 'CLOSING']
WIDTHS = [65, 22, 24, 22, 22, 25]

# ─── DAILY ────────────────────────────────────────────────────────────────────
if report_type == 'daily':
    records = payload['records']

    total_dubai    = sum(int(r.get('recv_dubai', 0) or 0) for r in records)
    total_umq      = sum(int(r.get('recv_umq', 0) or 0) for r in records)
    total_dispatch = sum(int(r.get('dispatch', 0) or 0) for r in records)
    total_closing  = sum(int(r.get('closing', 0) or 0) for r in records)

    pdf.kpi_row([
        ('Total Recv Dubai',  total_dubai,    TEAL),
        ('Total Recv UMQ',    total_umq,      (0, 100, 150)),
        ('Total Dispatched',  total_dispatch, ORANGE),
        ('Total Closing Stk', total_closing,  (100, 60, 180)),
    ])
    pdf.section_gap(2)

    grouped = {}
    for rec in records:
        cat = rec.get('category') or 'OTHER'
        grouped.setdefault(cat, []).append(rec)

    for cat, recs in grouped.items():
        pdf.cat_header(cat)
        pdf.col_header(COLS, WIDTHS)
        for i, rec in enumerate(recs):
            vals = [
                rec['product'],
                int(rec.get('opening', 0) or 0),
                int(rec.get('recv_dubai', 0) or 0),
                int(rec.get('recv_umq', 0) or 0),
                int(rec.get('dispatch', 0) or 0),
                int(rec.get('closing', 0) or 0),
            ]
            pdf.data_row(vals, WIDTHS, alt=i % 2 == 0,
                         col_styles=daily_col_styles(len(COLS), i % 2 == 0))
        pdf.section_gap()

    pdf.total_row(['GRAND TOTAL', '',
                   total_dubai, total_umq, total_dispatch, total_closing], WIDTHS)

# ─── MONTHLY ──────────────────────────────────────────────────────────────────
elif report_type == 'monthly':
    records = payload['records']

    total_dubai    = sum(int(r.get('recv_dubai', 0) or 0) for r in records)
    total_umq      = sum(int(r.get('recv_umq', 0) or 0) for r in records)
    total_dispatch = sum(int(r.get('dispatch', 0) or 0) for r in records)
    total_closing  = sum(int(r.get('closing', 0) or 0) for r in records)

    pdf.kpi_row([
        ('Total Recv Dubai',  total_dubai,    TEAL),
        ('Total Recv UMQ',    total_umq,      (0, 100, 150)),
        ('Total Dispatched',  total_dispatch, ORANGE),
        ('Month-End Stock',   total_closing,  (100, 60, 180)),
    ])
    pdf.section_gap(2)

    grouped = {}
    for rec in records:
        cat = rec.get('category') or 'OTHER'
        grouped.setdefault(cat, []).append(rec)

    for cat, recs in grouped.items():
        pdf.cat_header(cat)
        pdf.col_header(COLS, WIDTHS)
        for i, rec in enumerate(recs):
            vals = [
                rec['product'],
                int(rec.get('opening', 0) or 0),
                int(rec.get('recv_dubai', 0) or 0),
                int(rec.get('recv_umq', 0) or 0),
                int(rec.get('dispatch', 0) or 0),
                int(rec.get('closing', 0) or 0),
            ]
            pdf.data_row(vals, WIDTHS, alt=i % 2 == 0,
                         col_styles=daily_col_styles(len(COLS), i % 2 == 0))
        pdf.section_gap()

    pdf.total_row(['GRAND TOTAL', '',
                   total_dubai, total_umq, total_dispatch, total_closing], WIDTHS)

# ─── YEARLY ───────────────────────────────────────────────────────────────────
elif report_type == 'yearly':
    data = payload['data']

    total_recv_dubai = sum(int(r.get('total_recv_dubai', 0) or 0) for r in data)
    total_recv_umq   = sum(int(r.get('total_recv_umq',   0) or 0) for r in data)
    total_recv       = sum(int(r.get('total_recv',       0) or 0) for r in data)
    total_dispatch   = sum(int(r.get('total_dispatch',   0) or 0) for r in data)
    total_days       = sum(int(r.get('days_entered',     0) or 0) for r in data)

    pdf.kpi_row([
        ('Annual Recv Dubai',  total_recv_dubai, TEAL),
        ('Annual Recv UMQ',    total_recv_umq,   (0, 100, 150)),
        ('Annual Total Recv',  total_recv,       GREEN_TEXT),
        ('Annual Dispatched',  total_dispatch,   ORANGE),
        ('Days Entered',       total_days,       (100, 60, 180)),
    ])
    pdf.section_gap(2)

    Y_COLS   = ['MONTH', 'RECV DUBAI', 'RECV UMQ', 'TOTAL RECV', 'DISPATCH', 'LAST CLOSING', 'DAYS']
    Y_WIDTHS = [32, 24, 24, 26, 24, 26, 14]

    pdf.col_header(Y_COLS, Y_WIDTHS)

    y_styles_even = [
        {'color': DARK_TEXT, 'bold': True,  'bg': SKY},
        {'color': GREEN_TEXT,'bold': False, 'bg': SKY},
        {'color': GREEN_TEXT,'bold': False, 'bg': SKY},
        {'color': TEAL,      'bold': True,  'bg': MINT},
        {'color': ORANGE,    'bold': False, 'bg': SKY},
        {'color': NAVY,      'bold': True,  'bg': LIGHT_GOLD},
        {'color': MID_TEXT,  'bold': False, 'bg': SKY},
    ]
    y_styles_odd = [{**s, 'bg': WHITE if s['bg'] == SKY else s['bg']} for s in y_styles_even]

    for i, row in enumerate(data):
        vals = [
            row.get('label', ''),
            int(row.get('total_recv_dubai', 0) or 0),
            int(row.get('total_recv_umq', 0) or 0),
            int(row.get('total_recv', 0) or 0),
            int(row.get('total_dispatch', 0) or 0),
            int(row.get('last_closing', 0) or 0),
            int(row.get('days_entered', 0) or 0),
        ]
        styles = y_styles_even if i % 2 == 0 else y_styles_odd
        pdf.data_row(vals, Y_WIDTHS, alt=i % 2 == 0, col_styles=styles)

    pdf.total_row(
        ['ANNUAL TOTAL', total_recv_dubai, total_recv_umq,
         total_recv, total_dispatch, '', total_days],
        Y_WIDTHS
    )

pdf.output(output_path)
print(f'OK:{output_path}')
