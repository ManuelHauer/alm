#!/usr/bin/env python3
"""Generate a formatted PDF from the anti-AI sentiment research paper."""

import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

PAGE_W, PAGE_H = A4
MARGIN = 2.5 * cm

# ── Colour palette ───────────────────────────────────────────────────────────
RED       = colors.HexColor("#C0392B")
DARK      = colors.HexColor("#1A1A2E")
MID       = colors.HexColor("#2C3E50")
LIGHT_BG  = colors.HexColor("#F4F6F8")
RULE      = colors.HexColor("#BDC3C7")
CODE_BG   = colors.HexColor("#1E1E2E")
CODE_FG   = colors.HexColor("#CDD6F4")
ACCENT    = colors.HexColor("#E74C3C")

# ── Helper flowables ─────────────────────────────────────────────────────────
class ColorBar(Flowable):
    """A thin coloured rule with optional label."""
    def __init__(self, w, h=3, color=RED, label="", font_size=7):
        super().__init__()
        self.w, self.h = w, h
        self.color = color
        self.label = label
        self.font_size = font_size

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.rect(0, 0, self.w, self.h, fill=1, stroke=0)
        if self.label:
            self.canv.setFillColor(colors.white)
            self.canv.setFont("Helvetica-Bold", self.font_size)
            self.canv.drawString(4, 1, self.label)

    def wrap(self, *_):
        return self.w, self.h + 2


def make_styles():
    base = getSampleStyleSheet()

    def add(name, **kw):
        base.add(ParagraphStyle(name=name, **kw))
        return base[name]

    # Cover
    add("CoverTitle",
        fontName="Helvetica-Bold", fontSize=28, leading=34,
        textColor=colors.white, alignment=TA_LEFT, spaceAfter=8)
    add("CoverSub",
        fontName="Helvetica", fontSize=13, leading=18,
        textColor=colors.HexColor("#ECF0F1"), alignment=TA_LEFT, spaceAfter=6)
    add("CoverMeta",
        fontName="Helvetica", fontSize=9, leading=13,
        textColor=colors.HexColor("#BDC3C7"), alignment=TA_LEFT)

    # Body
    add("BodyText2",
        parent=base["BodyText"],
        fontName="Helvetica", fontSize=10, leading=15,
        textColor=MID, alignment=TA_JUSTIFY, spaceAfter=6, spaceBefore=2)
    add("Abstract",
        fontName="Helvetica-Oblique", fontSize=9.5, leading=14,
        textColor=colors.HexColor("#34495E"), alignment=TA_JUSTIFY,
        spaceAfter=4, leftIndent=18, rightIndent=18)
    add("Keywords",
        fontName="Helvetica", fontSize=8.5, leading=12,
        textColor=colors.HexColor("#7F8C8D"), spaceAfter=12,
        leftIndent=18)

    # Headings
    add("H1",
        fontName="Helvetica-Bold", fontSize=16, leading=20,
        textColor=DARK, spaceBefore=18, spaceAfter=6, keepWithNext=1)
    add("H2",
        fontName="Helvetica-Bold", fontSize=12, leading=16,
        textColor=RED, spaceBefore=14, spaceAfter=4, keepWithNext=1)
    add("H3",
        fontName="Helvetica-Bold", fontSize=10.5, leading=14,
        textColor=MID, spaceBefore=10, spaceAfter=3, keepWithNext=1)

    # Code / diagram block
    add("CodeBlock",
        fontName="Courier", fontSize=7.2, leading=10,
        textColor=CODE_FG, backColor=CODE_BG,
        leftIndent=10, rightIndent=10, spaceBefore=6, spaceAfter=6,
        borderPadding=(6, 8, 6, 8))

    # Figure caption
    add("Caption",
        fontName="Helvetica-Oblique", fontSize=8, leading=11,
        textColor=colors.HexColor("#7F8C8D"), alignment=TA_CENTER,
        spaceAfter=10, spaceBefore=2)

    # Table header / cell
    add("TH",
        fontName="Helvetica-Bold", fontSize=8.5, leading=11,
        textColor=colors.white, alignment=TA_LEFT)
    add("TD",
        fontName="Helvetica", fontSize=8, leading=11,
        textColor=MID, alignment=TA_LEFT)

    # Reference
    add("Ref",
        fontName="Helvetica", fontSize=8, leading=12,
        textColor=colors.HexColor("#555"), spaceAfter=3,
        leftIndent=14, firstLineIndent=-14)

    return base


# ── Page template (header/footer) ────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Header rule
    canvas.setFillColor(RED)
    canvas.rect(MARGIN, h - 1.5*cm, w - 2*MARGIN, 2, fill=1, stroke=0)
    # Running head
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#7F8C8D"))
    canvas.drawString(MARGIN, h - 1.3*cm, '"AI-Slop!" — Anti-AI Sentiment in Online Discourse · Working Paper May 2026')
    canvas.drawRightString(w - MARGIN, h - 1.3*cm, f"Page {doc.page}")
    # Footer
    canvas.setFillColor(RULE)
    canvas.rect(MARGIN, 1.2*cm, w - 2*MARGIN, 1, fill=1, stroke=0)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#999"))
    canvas.drawString(MARGIN, 0.85*cm, "Research · May 2026 · All data cited with primary sources")
    canvas.restoreState()


# ── Cover page builder ───────────────────────────────────────────────────────
def build_cover(styles):
    w, h = A4
    elems = []

    class Cover(Flowable):
        def draw(self):
            c = self.canv
            # Dark background panel
            c.setFillColor(DARK)
            c.rect(0, h*0.38, PAGE_W, h*0.62, fill=1, stroke=0)
            # Red accent stripe
            c.setFillColor(RED)
            c.rect(0, h*0.38 - 6, PAGE_W, 6, fill=1, stroke=0)
            # Decorative grid pattern (subtle)
            c.setStrokeColor(colors.HexColor("#16213E"))
            c.setLineWidth(0.5)
            for i in range(0, int(PAGE_W)+1, 40):
                c.line(i, h*0.38, i, h)
            for j in range(int(h*0.38), int(h)+1, 40):
                c.line(0, j, PAGE_W, j)
            # White box bottom
            c.setFillColor(colors.white)
            c.rect(0, 0, PAGE_W, h*0.38, fill=1, stroke=0)
            # Bottom accent
            c.setFillColor(RED)
            c.rect(0, h*0.38 - 2, 80, 2, fill=1, stroke=0)

        def wrap(self, *_):
            return PAGE_W, PAGE_H

    elems.append(Cover())

    # Overlay text via absolute positioned spacers + paragraphs trick:
    # We'll use a table to position text on the cover
    cover_text = [
        [Paragraph('"AI-Slop!"', styles["CoverTitle"])],
        [Paragraph("The Rise of Anti-AI-Generation Sentiment<br/>in Online Discourse: A Focus on Austria and Reddit",
                   styles["CoverSub"])],
        [Spacer(1, 0.5*cm)],
        [Paragraph("Working Paper &nbsp;·&nbsp; May 2026", styles["CoverMeta"])],
        [Paragraph("Research &amp; Analysis · Systematic Web Data Collection", styles["CoverMeta"])],
    ]

    t = Table(cover_text, colWidths=[PAGE_W - 2*MARGIN])
    t.setStyle(TableStyle([
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
    ]))

    # We can't truly layer in ReportLab without a canvas hack; instead use
    # absolute positioning via a frame override. Simplest: just render text
    # after cover as a "page 0" with no header. We'll do it cleanly.
    return elems


# ── Main content parser ──────────────────────────────────────────────────────
def escape_xml(text):
    return (text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("—", "&#8212;")
        .replace("–", "&#8211;")
        .replace(""", "&#8220;")
        .replace(""", "&#8221;")
        .replace("'", "&#8216;")
        .replace("'", "&#8217;")
        .replace("…", "&#8230;")
        .replace("×", "&#215;")
        .replace("▲", "&#9650;")
        .replace("▼", "&#9660;")
        .replace("█", "&#9608;")
        .replace("░", "&#9617;")
        .replace("┌", "+").replace("┐", "+").replace("└", "+").replace("┘", "+")
        .replace("├", "+").replace("┤", "+").replace("┬", "+").replace("┴", "+")
        .replace("┼", "+").replace("│", "|").replace("─", "-")
        .replace("·", "&#183;"))


def md_inline(text, styles):
    """Convert inline markdown (bold, italic, code) to ReportLab XML."""
    # Bold-italic
    text = re.sub(r'\*\*\*(.+?)\*\*\*', r'<b><i>\1</i></b>', text)
    # Bold
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    # Italic
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
    # Inline code
    text = re.sub(r'`([^`]+)`', r'<font name="Courier" color="#C0392B">\1</font>', text)
    # Links — keep label only
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    return text


def parse_md_to_flowables(md_path, styles):
    with open(md_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    flowables = []
    i = 0
    in_code = False
    code_lines = []
    in_table = False
    table_rows = []
    abstract_mode = False

    def flush_code():
        nonlocal code_lines
        if not code_lines:
            return
        raw = "\n".join(code_lines)
        safe = escape_xml(raw)
        # Wrap in Courier, white-on-dark
        text = safe.replace("\n", "<br/>").replace(" ", "&nbsp;")
        p = Paragraph(text, styles["CodeBlock"])
        flowables.append(KeepTogether([p]))
        flowables.append(Spacer(1, 2))
        code_lines = []

    def flush_table():
        nonlocal table_rows, in_table
        if not table_rows:
            in_table = False
            return
        # Filter separator rows
        data_rows = [r for r in table_rows if not all(set(c.strip()) <= set('-| ') for c in r)]
        if not data_rows:
            in_table = False
            table_rows = []
            return

        col_count = max(len(r) for r in data_rows)
        col_w = (PAGE_W - 2*MARGIN) / col_count

        table_data = []
        for ri, row in enumerate(data_rows):
            while len(row) < col_count:
                row.append("")
            style_name = "TH" if ri == 0 else "TD"
            table_data.append([
                Paragraph(escape_xml(cell.strip()), styles[style_name])
                for cell in row
            ])

        tbl = Table(table_data, colWidths=[col_w]*col_count, repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), MID),
            ("BACKGROUND", (0,1), (-1,-1), LIGHT_BG),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
            ("GRID", (0,0), (-1,-1), 0.4, RULE),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
            ("RIGHTPADDING", (0,0), (-1,-1), 6),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
        ]))
        flowables.append(tbl)
        flowables.append(Spacer(1, 6))
        table_rows = []
        in_table = False

    while i < len(lines):
        line = lines[i].rstrip("\n")

        # --- Code fence ---
        if line.strip().startswith("```"):
            if in_code:
                flush_code()
                in_code = False
            else:
                in_code = True
            i += 1
            continue

        if in_code:
            code_lines.append(line)
            i += 1
            continue

        # --- Table row ---
        if line.strip().startswith("|"):
            if not in_table:
                in_table = True
            cells = [c for c in line.strip().split("|")][1:-1]
            table_rows.append(cells)
            i += 1
            continue
        elif in_table:
            flush_table()

        # --- HR ---
        if re.match(r'^---+$', line.strip()):
            flowables.append(Spacer(1, 6))
            flowables.append(HRFlowable(width="100%", thickness=1, color=RULE))
            flowables.append(Spacer(1, 6))
            i += 1
            continue

        # --- Headings ---
        m = re.match(r'^(#{1,4})\s+(.*)', line)
        if m:
            level = len(m.group(1))
            text = escape_xml(md_inline(m.group(2), styles))
            if level == 1:
                # Only the document title
                flowables.append(Spacer(1, 0.3*cm))
                flowables.append(Paragraph(text, styles["H1"]))
                flowables.append(ColorBar(PAGE_W - 2*MARGIN, 3, RED))
                flowables.append(Spacer(1, 4))
            elif level == 2:
                flowables.append(Spacer(1, 0.2*cm))
                num_text = text
                flowables.append(Paragraph(num_text, styles["H2"]))
            elif level >= 3:
                flowables.append(Paragraph(text, styles["H3"]))
            i += 1
            continue

        # --- Bold label lines (Figure N:) ---
        if line.strip().startswith("**Figure"):
            text = escape_xml(md_inline(line.strip(), styles))
            flowables.append(Paragraph(text, styles["Caption"]))
            i += 1
            continue

        # --- Abstract block detection ---
        if line.strip() == "## Abstract":
            flowables.append(Paragraph("Abstract", styles["H2"]))
            i += 1
            # Collect until next ##
            abs_lines = []
            while i < len(lines) and not lines[i].startswith("##"):
                abs_lines.append(lines[i].rstrip("\n"))
                i += 1
            abs_text = " ".join(l for l in abs_lines if l.strip())
            abs_text = escape_xml(md_inline(abs_text, styles))
            flowables.append(Paragraph(abs_text, styles["Abstract"]))
            # Keywords line
            if i < len(lines) and "Keywords" in lines[i]:
                kw = lines[i].rstrip("\n")
                flowables.append(Paragraph(escape_xml(kw), styles["Keywords"]))
                i += 1
            continue

        # --- Empty line ---
        if not line.strip():
            flowables.append(Spacer(1, 4))
            i += 1
            continue

        # --- Blockquote / italic lines (citations in italics) ---
        if line.strip().startswith(">"):
            text = escape_xml(md_inline(line.strip()[1:].strip(), styles))
            flowables.append(Paragraph(f"<i>{text}</i>", styles["Abstract"]))
            i += 1
            continue

        # --- List items ---
        m_li = re.match(r'^(\s*)[*\-]\s+(.*)', line)
        if m_li:
            text = escape_xml(md_inline(m_li.group(2), styles))
            indent = len(m_li.group(1))
            bullet_style = ParagraphStyle(
                "Bullet", parent=styles["BodyText2"],
                leftIndent=18 + indent*10, firstLineIndent=-10,
                spaceBefore=1, spaceAfter=1
            )
            flowables.append(Paragraph(f"&#8226;&nbsp; {text}", bullet_style))
            i += 1
            continue

        # --- Numbered list ---
        m_nl = re.match(r'^\s*(\d+)\.\s+(.*)', line)
        if m_nl:
            text = escape_xml(md_inline(m_nl.group(2), styles))
            num = m_nl.group(1)
            nl_style = ParagraphStyle(
                "NumList", parent=styles["BodyText2"],
                leftIndent=22, firstLineIndent=-14,
                spaceBefore=1, spaceAfter=1
            )
            flowables.append(Paragraph(f"<b>{num}.</b>&nbsp; {text}", nl_style))
            i += 1
            continue

        # --- Regular paragraph ---
        text = escape_xml(md_inline(line.strip(), styles))
        if text:
            flowables.append(Paragraph(text, styles["BodyText2"]))
        i += 1

    if in_code:
        flush_code()
    if in_table:
        flush_table()

    return flowables


# ── Cover page (drawn directly on canvas) ───────────────────────────────────
def draw_cover(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Dark panel top 62%
    canvas.setFillColor(DARK)
    canvas.rect(0, h * 0.36, w, h * 0.64, fill=1, stroke=0)
    # Subtle grid
    canvas.setStrokeColor(colors.HexColor("#16213E"))
    canvas.setLineWidth(0.4)
    for x in range(0, int(w)+1, 35):
        canvas.line(x, h*0.36, x, h)
    for y in range(int(h*0.36), int(h)+1, 35):
        canvas.line(0, y, w, y)
    # Red stripe
    canvas.setFillColor(RED)
    canvas.rect(0, h*0.36 - 5, w, 5, fill=1, stroke=0)
    # White bottom
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, w, h*0.36, fill=1, stroke=0)
    # Light bg bottom
    canvas.setFillColor(LIGHT_BG)
    canvas.rect(MARGIN, 1.5*cm, w - 2*MARGIN, h*0.36 - 2.2*cm, fill=1, stroke=0)

    # Title text
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 36)
    canvas.drawString(MARGIN, h * 0.84, '“AI-Slop!”')

    canvas.setFont("Helvetica-Bold", 16)
    canvas.drawString(MARGIN, h * 0.78, "The Rise of Anti-AI-Generation Sentiment")
    canvas.setFont("Helvetica", 14)
    canvas.drawString(MARGIN, h * 0.74, "in Online Discourse: A Focus on Austria and Reddit")

    canvas.setFillColor(colors.HexColor("#BDC3C7"))
    canvas.setFont("Helvetica", 10)
    canvas.drawString(MARGIN, h * 0.67, "Working Paper  ·  May 2026")
    canvas.drawString(MARGIN, h * 0.645, "Research & Analysis  ·  Systematic Web Data Collection")

    # Bottom metadata box
    canvas.setFillColor(MID)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(MARGIN + 10, h * 0.33, "KEY FINDINGS")
    canvas.setFont("Helvetica", 8.5)
    canvas.setFillColor(colors.HexColor("#444"))
    findings = [
        "•  “AI slop” mentions grew 9× in a single year (461K → 2.4M)",
        "•  Austria has net-negative AI sentiment; one of only 3 EU states with distrust > trust",
        "•  15% of Reddit posts likely AI-generated (2025); bot traffic exceeds human traffic globally",
        "•  Anti-AI calling-out is institutionalised as community moderation behaviour",
    ]
    for j, f in enumerate(findings):
        canvas.drawString(MARGIN + 10, h * 0.295 - j * 14, f)

    # Red accent line bottom
    canvas.setFillColor(RED)
    canvas.rect(MARGIN, 1.15*cm, 60, 3, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#999"))
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(MARGIN + 68, 1.18*cm, "All data cited with primary sources · May 2026")

    canvas.restoreState()


# ── Build PDF ────────────────────────────────────────────────────────────────
def build_pdf(md_path, out_path):
    styles = make_styles()

    doc = SimpleDocTemplate(
        out_path,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=2.2*cm, bottomMargin=2.0*cm,
        title='"AI-Slop!" — Anti-AI Sentiment Research Paper',
        author="Research · May 2026",
        subject="Anti-AI Generation Sentiment, Austria, Reddit",
    )

    story = []

    # Cover page (blank content — drawn via onFirstPage)
    story.append(PageBreak())

    # Content
    content = parse_md_to_flowables(md_path, styles)
    story.extend(content)

    doc.build(
        story,
        onFirstPage=draw_cover,
        onLaterPages=on_page,
    )
    print(f"PDF written to: {out_path}")


if __name__ == "__main__":
    import sys, os
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    md = os.path.join(base, "docs", "anti-ai-sentiment-research.md")
    out = os.path.join(base, "docs", "anti-ai-sentiment-research.pdf")
    build_pdf(md, out)
