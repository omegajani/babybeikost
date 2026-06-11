"""Atlas-Beikost-Menüs aus *L'atlante dello svezzamento* (Gribaudo, 2024, S. 232).

Zwei Wochenmenüs (Settimana 1 & 2) mit je Mittag (pranzo) und Abend (cena),
plus Frühstücks- und Snack-Ideen. Inhalte sind zweisprachig (IT kanonisch / DE).

WICHTIG: Die genauen Zutatenmengen stehen nur im Buch, nicht in der Vorlage.
Deshalb tragen die Zutaten hier KEINE Mengen – sie dienen der Einkaufsliste als
reine Posten. `name` ist immer der kanonische (italienische) Name; `name_de` ist
die deutsche Übersetzung für den Sprachumschalter.
"""

# Regal-Kürzel (müssen zu AISLES in main.py passen)
OG = "Obst & Gemüse"
MP = "Milchprodukte"
GB = "Getreide & Beilagen"
FF = "Fleisch & Fisch"
VO = "Vorrat"
SO = "Sonstiges"


def _r(name, name_de, food_group, notes, notes_de, ings):
    """Kompakter Rezept-Konstruktor. `ings` = Liste aus (it, de, aisle).

    Die App ist einsprachig Deutsch: der deutsche Text ist der kanonische `name`
    (bzw. `notes`), die `*_de`-Felder bleiben leer. Die italienischen Originale aus
    den Argumenten werden nur als Fallback genutzt, falls keine Übersetzung vorliegt.
    """
    return {
        "name": name_de or name,
        "name_de": "",
        "food_group": food_group,
        "notes": notes_de or notes,
        "notes_de": "",
        "ingredients": [{"name": de or it, "name_de": "", "aisle": a} for it, de, a in ings],
    }


# --------------------------------------------------------------------------
# Rezepte, nach Slug (dedupliziert über beide Wochen)
# --------------------------------------------------------------------------
RECIPES = {
    # ---- Settimana 1 ----
    "peperoni_pollo": _r(
        "Crema di peperoni rossi, cuscus e pollo",
        "Rote-Paprika-Creme mit Couscous & Hähnchen", "carne",
        "Per i genitori: condire una pasta con la crema di peperoni e tenere la porzione di pollo non frullata. Variante: peperoni → zucchine e timo.",
        "Erwachsene: Paprikacreme als Pastasauce, Hähnchen-Portion ungemixt. Variante: Paprika durch Zucchini & Thymian ersetzen.",
        [("peperoni rossi", "Rote Paprika", OG), ("cuscus", "Couscous", GB), ("pollo", "Hähnchen", FF)]),
    "melanzane_fagioli": _r(
        "Pappa di melanzane, basilico e fagioli bianchi",
        "Auberginen-Basilikum-Brei mit weißen Bohnen", "legumi",
        "Sugo di melanzane per condire la pasta + parmigiano + bruschetta con fagioli all'olio.",
        "Auberginensugo als Pastasauce + Parmesan + Brot mit Bohnen in Öl.",
        [("melanzane", "Aubergine", OG), ("basilico", "Basilikum", OG), ("fagioli bianchi", "Weiße Bohnen", VO)]),
    "patatedolci_tofu": _r(
        "Crema di patate dolci con piselli, cocco e tofu",
        "Süßkartoffel-Erbsen-Creme mit Kokos & Tofu", "legumi",
        "Tofu a cubetti in padella con olio e curry, sulla crema di patate dolci e cocco, con riso Basmati. Variante: patate dolci → patate normali.",
        "Tofuwürfel mit Öl & Curry anbraten, auf Süßkartoffel-Kokos-Creme mit Basmatireis. Variante: Süßkartoffel → normale Kartoffel.",
        [("patate dolci", "Süßkartoffel", OG), ("piselli", "Erbsen", OG), ("latte di cocco", "Kokosmilch", VO), ("tofu", "Tofu", SO)]),
    "fagiolini_merluzzo": _r(
        "Crema di fagiolini e patate con merluzzo",
        "Grüne-Bohnen-Kartoffel-Creme mit Kabeljau", "pesce",
        "Insalata tiepida di fagiolini e patate con prezzemolo; merluzzo a vapore con olio e limone.",
        "Lauwarmer Bohnen-Kartoffel-Salat mit Petersilie; Kabeljau gedämpft mit Öl & Zitrone.",
        [("fagiolini", "Grüne Bohnen", OG), ("patate", "Kartoffel", OG), ("prezzemolo", "Petersilie", OG), ("merluzzo", "Kabeljau", FF)]),
    "carote_ricotta": _r(
        "Purea di carote con ricotta",
        "Karottenpüree mit Ricotta", "formaggi",
        "Crema da spalmare su bruschette, guarnita con ricotta e semi.",
        "Creme zum Bestreichen von Brot, mit Ricotta & Saaten garnieren.",
        [("carote", "Karotte", OG), ("noce moscata", "Muskatnuss", VO), ("semi", "Saaten", VO), ("ricotta", "Ricotta", MP)]),
    "broccoli_ceci": _r(
        "Crema di broccoli con porro e ceci",
        "Brokkolicreme mit Lauch & Kichererbsen", "legumi",
        "Crema come condimento per la pasta, ceci interi. Variante: aggiungere peperoni e pomodori arrostiti.",
        "Creme als Pastasauce, Kichererbsen ganz lassen. Variante: geröstete Paprika & Tomaten zugeben.",
        [("broccoli", "Brokkoli", OG), ("porro", "Lauch", OG), ("erba cipollina", "Schnittlauch", OG), ("ceci", "Kichererbsen", VO)]),
    "avena_lenticchie": _r(
        "Crema di avena, lenticchie e zucchine",
        "Hafer-Linsen-Creme mit Zucchini", "legumi",
        "Lenticchie decorticate cotte con la crema di zucchine, frullare bene. Per adulti come condimento per la pasta.",
        "Rote Linsen mit Zucchinicreme kochen, gut pürieren. Für Erwachsene als Pastasauce.",
        [("avena", "Haferflocken", GB), ("lenticchie decorticate", "Rote Linsen", VO), ("zucchine", "Zucchini", OG), ("timo", "Thymian", OG)]),
    "asparagi_uova": _r(
        "Crema di asparagi e menta con miglio e uova",
        "Spargel-Minze-Creme mit Hirse & Ei", "uova",
        "Vellutata di asparagi con miglio o pane integrale tostato e uovo in camicia. Variante: asparagi → fagioli o zucchine.",
        "Spargelsüppchen mit Hirse oder Vollkorntoast & pochiertem Ei. Variante: Spargel → Bohnen oder Zucchini.",
        [("asparagi", "Spargel", OG), ("menta", "Minze", OG), ("miglio", "Hirse", GB), ("uova", "Ei", MP)]),
    "piselli_sogliola": _r(
        "Purea con piselli e sogliola",
        "Erbsenpüree mit Seezunge", "pesce",
        "Prelevare patate e pesce prima di frullare; in fase 2 aggiungere un cereale piccolo come pastina o cuscus.",
        "Kartoffel & Fisch vor dem Pürieren entnehmen; Phase 2: kleines Getreide wie Pastina oder Couscous zugeben.",
        [("piselli", "Erbsen", OG), ("patate", "Kartoffel", OG), ("sogliola", "Seezunge", FF)]),
    "riso_rosa_ricotta": _r(
        "Riso rosa e ricotta",
        "Rosa Reis mit Ricotta", "formaggi",
        "Fase 1 farina di riso; fase 2 riso poco frullato + ricotta, condire con crema di barbabietola e parmigiano.",
        "Phase 1 Reismehl; Phase 2 grob pürierter Reis + Ricotta, mit Rote-Bete-Creme & Parmesan.",
        [("riso", "Reis", GB), ("barbabietola", "Rote Bete", OG), ("ricotta", "Ricotta", MP)]),
    "riso_cavolfiore_formaggio": _r(
        "Pappa con riso, cavolfiore, carota e formaggio",
        "Brei mit Reis, Blumenkohl, Karotte & Käse", "formaggi",
        "Mantenere la consistenza delle verdure e servirle con riso e formaggio.",
        "Gemüse stückig lassen und mit Reis & Käse servieren.",
        [("riso", "Reis", GB), ("cavolfiore", "Blumenkohl", OG), ("carota", "Karotte", OG), ("formaggio", "Käse", MP)]),
    "bulgur_merluzzo": _r(
        "Bulgur con zucchine, pomodorini e merluzzo",
        "Bulgur mit Zucchini, Kirschtomaten & Kabeljau", "pesce",
        "Fase 1 frullare; fase 2 schiacciare bene pesce e verdure. Adulti: polpette in padella.",
        "Phase 1 pürieren; Phase 2 Fisch & Gemüse gut zerdrücken. Erwachsene: Bratlinge in der Pfanne.",
        [("bulgur", "Bulgur", GB), ("zucchine", "Zucchini", OG), ("pomodorini", "Kirschtomaten", OG), ("merluzzo", "Kabeljau", FF)]),
    "saraceno_tacchino": _r(
        "Pappa con grano saraceno, broccolo romanesco, carota e tacchino",
        "Brei mit Buchweizen, Romanesco, Karotte & Pute", "carne",
        "Insalata tiepida condita con olio, timo e succo di limone; accompagnare con hummus.",
        "Lauwarmer Salat mit Öl, Thymian & Zitronensaft; dazu Hummus.",
        [("grano saraceno", "Buchweizen", GB), ("broccolo romanesco", "Romanesco", OG), ("carota", "Karotte", OG), ("tacchino", "Pute", FF)]),
    "zucchine_uovo": _r(
        "Crema di zucchine e timo con pastina e uovo",
        "Zucchini-Thymian-Creme mit Pastina & Ei", "uova",
        "Fase 1 uovo frullato nella pappa; fase 2 sbriciolato grossolanamente o uovo strapazzato.",
        "Phase 1 Ei in den Brei pürieren; Phase 2 grob zerbröselt oder als Rührei.",
        [("zucchine", "Zucchini", OG), ("timo", "Thymian", OG), ("pastina", "Pastina", GB), ("uovo", "Ei", MP)]),
    # ---- Settimana 2 ----
    "carciofi_vitello": _r(
        "Crema di carciofi, vitello e prezzemolo",
        "Artischockencreme mit Kalb & Petersilie", "carne",
        "Carciofi a pezzi + fettine di vitello cotte a parte, con quinoa o riso.",
        "Artischocken stückig + separat gebratene Kalbsschnitzelchen, mit Quinoa oder Reis.",
        [("carciofi", "Artischocken", OG), ("vitello", "Kalbfleisch", FF), ("prezzemolo", "Petersilie", OG)]),
    "curry_lenticchie": _r(
        "Curry di lenticchie e cocco speziato",
        "Linsen-Kokos-Curry, mild gewürzt", "legumi",
        "Prelevare e frullare la porzione del bambino; gli adulti accompagnano con riso Basmati.",
        "Babyportion entnehmen & pürieren; Erwachsene mit Basmatireis.",
        [("lenticchie", "Linsen", VO), ("latte di cocco", "Kokosmilch", VO), ("curry", "Currypulver", VO), ("riso basmati", "Basmatireis", GB)]),
    "cuscus_zucca_uovo": _r(
        "Cuscus con zucca e uovo",
        "Couscous mit Kürbis & Ei", "uova",
        "Zucca in padella con olio e rosmarino su una base di cuscus e uova sode a fettine. Variante: zucca → carota o mix di verdure di stagione.",
        "Kürbis mit Öl & Rosmarin auf Couscous-Basis mit hartem Ei in Scheiben. Variante: Kürbis → Karotte oder Saisongemüse-Mix.",
        [("cuscus", "Couscous", GB), ("zucca", "Kürbis", OG), ("uovo", "Ei", MP)]),
    "riso_pesce_broccolo": _r(
        "Riso e pesce con broccolo e carote",
        "Reis & Fisch mit Brokkoli & Karotten", "pesce",
        "Pesto di broccolo (broccolo cotto + crema di frutta secca o semi, olio ed erbe) per condire il riso; pesce a parte.",
        "Brokkoli-Pesto (gegarter Brokkoli + Nuss-/Saatencreme, Öl & Kräuter) für den Reis; Fisch separat.",
        [("riso", "Reis", GB), ("pesce", "Fisch", FF), ("broccolo", "Brokkoli", OG), ("carote", "Karotte", OG)]),
    "avena_verdure_ricotta": _r(
        "Crema di avena o cuscus con verdure e ricotta",
        "Hafer- oder Couscous-Gemüse-Creme mit Ricotta", "formaggi",
        "Bruschette con ricotta e verdure a pezzi del cuscus. Variante: cuscus → orzo o farro (fase 3).",
        "Brot mit Ricotta und Gemüse stückig vom Couscous. Variante: Couscous → Gerste oder Dinkel (Phase 3).",
        [("avena", "Haferflocken", GB), ("cuscus", "Couscous", GB), ("verdure miste", "Gemüse (gemischt)", OG), ("ricotta", "Ricotta", MP)]),
    "finocchio_tofu": _r(
        "Pappa al finocchio con riso e tofu",
        "Fenchelbrei mit Reis & Tofu", "legumi",
        "Insalata di finocchio e arancia con cubetti di tofu croccante.",
        "Fenchel-Orangen-Salat mit knusprigen Tofuwürfeln.",
        [("finocchio", "Fenchel", OG), ("riso", "Reis", GB), ("succo di arancia", "Orangensaft", OG), ("tofu", "Tofu", SO)]),
    "pastina_ceci": _r(
        "Pastina con ceci e verdure",
        "Pastina mit Kichererbsen & Gemüse", "legumi",
        "Bruschette con crema di ceci accompagnate da verdure.",
        "Brot mit Kichererbsencreme, dazu Gemüse.",
        [("pastina", "Pastina", GB), ("ceci", "Kichererbsen", VO), ("verdure", "Gemüse", OG)]),
    "patate_cavolonero_uovo": _r(
        "Crema di patate e cavolo nero con uovo strapazzato",
        "Kartoffel-Schwarzkohl-Creme mit Rührei", "uova",
        "Prelevare e frullare la porzione del bambino; gli adulti accompagnano con riso Basmati.",
        "Babyportion entnehmen & pürieren; Erwachsene mit Basmatireis.",
        [("patate", "Kartoffel", OG), ("cavolo nero", "Schwarzkohl", OG), ("erbe aromatiche", "Kräuter", OG), ("semi", "Saaten", VO), ("pastina", "Pastina", GB), ("uovo", "Ei", MP)]),
    "kale_merluzzo": _r(
        "Purea di kale con miglio e merluzzo",
        "Grünkohlpüree mit Hirse & Kabeljau", "pesce",
        "Adulti: un tortino o delle polpette con gli stessi ingredienti.",
        "Erwachsene: ein Auflauf oder Bratlinge aus denselben Zutaten.",
        [("kale", "Grünkohl", OG), ("miglio", "Hirse", GB), ("merluzzo", "Kabeljau", FF)]),
    "miglio_manzo": _r(
        "Pappa con miglio, carota, zucca e manzo",
        "Brei mit Hirse, Karotte, Kürbis & Rind", "carne",
        "Mantenere le consistenze di miglio e verdure, cuocere il manzo a parte. Variante: carota e zucca → zucchine e fagiolini.",
        "Hirse & Gemüse stückig lassen, Rind separat garen. Variante: Karotte & Kürbis → Zucchini & grüne Bohnen.",
        [("miglio", "Hirse", GB), ("carota", "Karotte", OG), ("zucca", "Kürbis", OG), ("manzo", "Rindfleisch", FF)]),
    "bulgur_quinoa_rapa": _r(
        "Bulgur e quinoa con rapa e pesce",
        "Bulgur & Quinoa mit Speiserübe & Fisch", "pesce",
        "Cuocere il pesce a parte ed evitare di frullare i cereali e la verdura.",
        "Fisch separat garen, Getreide & Gemüse nicht pürieren.",
        [("bulgur", "Bulgur", GB), ("quinoa", "Quinoa", GB), ("rapa", "Speiserübe", OG), ("pesce", "Fisch", FF)]),

    # ---- Frühstücke (colazione) ----
    "b1_porridge_fragole": _r(
        "Porridge freddo alle fragole", "Kaltes Porridge mit Erdbeeren", "",
        "", "",
        [("fiocchi di avena", "Haferflocken", GB), ("fragole", "Erdbeeren", OG), ("latte", "Milch", MP)]),
    "b1_porridge_bosco": _r(
        "Porridge ai frutti di bosco", "Porridge mit Waldbeeren", "",
        "", "",
        [("fiocchi di avena", "Haferflocken", GB), ("frutti di bosco", "Waldbeeren", OG), ("latte", "Milch", MP)]),
    "b1_frutta_mandorla": _r(
        "Fragole, lamponi, cocco e latte di mandorla con avena",
        "Erdbeeren, Himbeeren, Kokos & Mandelmilch mit Haferflocken", "",
        "", "",
        [("fragole", "Erdbeeren", OG), ("lamponi", "Himbeeren", OG), ("cocco", "Kokos", VO), ("latte di mandorla", "Mandelmilch", VO), ("fiocchi di avena", "Haferflocken", GB)]),
    "b2_porridge_mela": _r(
        "Porridge mela e cannella", "Porridge mit Apfel & Zimt", "",
        "", "",
        [("fiocchi di avena", "Haferflocken", GB), ("mela", "Apfel", OG), ("cannella", "Zimt", VO), ("latte", "Milch", MP)]),
    "b2_avena_nocciole": _r(
        "Crema di avena con banana e crema di nocciole",
        "Haferbrei mit Banane & Haselnusscreme", "",
        "", "",
        [("fiocchi di avena", "Haferflocken", GB), ("banana", "Banane", OG), ("crema di nocciole", "Haselnusscreme", VO)]),
    "b2_pancake_banana": _r(
        "Pancake alla banana con crema di frutta secca",
        "Bananenpancakes mit Nusscreme", "",
        "", "",
        [("banana", "Banane", OG), ("uova", "Ei", MP), ("farina", "Mehl", GB), ("crema di frutta secca", "Nusscreme", VO)]),

    # ---- Snacks (merenda) ----
    "s1_yogurt_pesca": _r(
        "Yogurt con pesca frullata e crema di frutta secca",
        "Joghurt mit püriertem Pfirsich & Nusscreme", "",
        "", "",
        [("yogurt", "Joghurt", MP), ("pesca", "Pfirsich", OG), ("crema di frutta secca", "Nusscreme", VO), ("cereali soffiati", "Puffgetreide", GB)]),
    "s1_smoothie_avocado": _r(
        "Smoothie avocado, banana e mango",
        "Smoothie Avocado, Banane & Mango", "",
        "", "",
        [("avocado", "Avocado", OG), ("banana", "Banane", OG), ("mango", "Mango", OG), ("cereali soffiati", "Puffgetreide", GB)]),
    "s1_gelatino_smoothie": _r(
        "Gelatino di smoothie con banana, mela e carota",
        "Smoothie-Gelee mit Banane, Apfel & Karotte", "",
        "", "",
        [("banana", "Banane", OG), ("mela", "Apfel", OG), ("carota", "Karotte", OG)]),
    "s2_avocado_limone": _r(
        "Avocado schiacciato con limone e cipollotto",
        "Zerdrückte Avocado mit Zitrone & Frühlingszwiebel", "",
        "", "",
        [("avocado", "Avocado", OG), ("limone", "Zitrone", OG), ("cipollotto", "Frühlingszwiebel", OG), ("cereali soffiati", "Puffgetreide", GB)]),
    "s2_banana_mandorle": _r(
        "Banana schiacciata con crema di mandorle",
        "Zerdrückte Banane mit Mandelcreme", "",
        "", "",
        [("banana", "Banane", OG), ("crema di mandorle", "Mandelcreme", VO), ("pane", "Brot", GB)]),
    "s2_yogurt_mela": _r(
        "Yogurt alla mela e cannella con frutta secca",
        "Joghurt mit Apfel, Zimt & Nusscreme", "",
        "", "",
        [("yogurt", "Joghurt", MP), ("mela", "Apfel", OG), ("cannella", "Zimt", VO), ("crema di frutta secca", "Nusscreme", VO), ("cereali", "Getreide", GB)]),
}


# --------------------------------------------------------------------------
# Wochenpläne: Tag -> {meal-slug: rezept-slug}
# Frühstücke/Snacks rotieren über die 7 Tage.
# --------------------------------------------------------------------------
WEEK1 = {
    "mon": {"pranzo": "peperoni_pollo", "cena": "melanzane_fagioli"},
    "tue": {"pranzo": "patatedolci_tofu", "cena": "fagiolini_merluzzo"},
    "wed": {"pranzo": "carote_ricotta", "cena": "broccoli_ceci"},
    "thu": {"pranzo": "avena_lenticchie", "cena": "asparagi_uova"},
    "fri": {"pranzo": "piselli_sogliola", "cena": "riso_rosa_ricotta"},
    "sat": {"pranzo": "riso_cavolfiore_formaggio", "cena": "bulgur_merluzzo"},
    "sun": {"pranzo": "saraceno_tacchino", "cena": "zucchine_uovo"},
}

WEEK2 = {
    "mon": {"pranzo": "carciofi_vitello", "cena": "curry_lenticchie"},
    "tue": {"pranzo": "cuscus_zucca_uovo", "cena": "riso_pesce_broccolo"},
    "wed": {"pranzo": "avena_verdure_ricotta", "cena": "finocchio_tofu"},
    "thu": {"pranzo": "pastina_ceci", "cena": "patate_cavolonero_uovo"},
    "fri": {"pranzo": "kale_merluzzo", "cena": "riso_cavolfiore_formaggio"},
    "sat": {"pranzo": "miglio_manzo", "cena": "bulgur_quinoa_rapa"},
    "sun": {"pranzo": "saraceno_tacchino", "cena": "cuscus_zucca_uovo"},
}

BREAKFASTS = {
    1: ["b1_porridge_fragole", "b1_porridge_bosco", "b1_frutta_mandorla"],
    2: ["b2_porridge_mela", "b2_avena_nocciole", "b2_pancake_banana"],
}

SNACKS = {
    1: ["s1_yogurt_pesca", "s1_smoothie_avocado", "s1_gelatino_smoothie"],
    2: ["s2_avocado_limone", "s2_banana_mandorle", "s2_yogurt_mela"],
}

WEEKS = {1: WEEK1, 2: WEEK2}
DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _assign_categories() -> None:
    """Derive a recipe category from each dish's role in the week plans.

    Breakfasts → Frühstück, snacks → Snack; mains get Mittag if they appear as
    pranzo anywhere, otherwise Abend. Keeps the Rezepte tab grouping meaningful.
    """
    breakfast_slugs = {s for lst in BREAKFASTS.values() for s in lst}
    snack_slugs = {s for lst in SNACKS.values() for s in lst}
    pranzo_slugs = {m["pranzo"] for week in WEEKS.values() for m in week.values()}
    cena_slugs = {m["cena"] for week in WEEKS.values() for m in week.values()}
    for slug, rec in RECIPES.items():
        if slug in breakfast_slugs:
            rec["category"] = "Frühstück"
        elif slug in snack_slugs:
            rec["category"] = "Snack"
        elif slug in pranzo_slugs:
            rec["category"] = "Mittag"
        elif slug in cena_slugs:
            rec["category"] = "Abend"
        else:
            rec["category"] = ""


_assign_categories()


def week_plan_rows(week: int):
    """Liefert die zu setzenden Plan-Zeilen für eine Beispielwoche.

    Returns Liste aus (recipe_slug, day, meal). Frühstück (colazione) und Snack
    (merenda) rotieren über die Woche; Mittag/Abend kommen aus dem Wochenmenü.
    """
    rows = []
    breakfasts = BREAKFASTS[week]
    snacks = SNACKS[week]
    for i, day in enumerate(DAY_ORDER):
        rows.append((breakfasts[i % len(breakfasts)], day, "colazione"))
        meals = WEEKS[week][day]
        rows.append((meals["pranzo"], day, "pranzo"))
        rows.append((meals["cena"], day, "cena"))
        rows.append((snacks[i % len(snacks)], day, "merenda"))
    return rows
