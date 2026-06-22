export default async function handler(req, res) {
    // Povolení pouze metody POST
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, message: `Metoda ${req.method} není povolena` });
    }

    const { name, email, phone, subject, message } = req.body;

    // Kontrola povinných parametrů
    if (!name || !email || !phone || !subject || !message) {
        return res.status(400).json({ success: false, message: 'Chybí povinná pole formuláře.' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error('RESEND_API_KEY není definován v proměnných prostředí.');
        return res.status(500).json({ success: false, message: 'Server není správně nakonfigurován (chybí API klíč).' });
    }

    try {
        // Souběžné odeslání obou e-mailů (poptávky adminovi i potvrzení zákazníkovi)
        const [adminRes, customerRes] = await Promise.all([
            // 1. Notifikace pro administrátora na info@digitalestudio.cz
            fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    from: 'info@digitalestudio.cz',
                    to: 'info@digitalestudio.cz',
                    subject: `Nová poptávka: ${subject}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; color: #1f2937; line-height: 1.6;">
                            <h2 style="color: #2b66ff; border-bottom: 2px solid #2b66ff; padding-bottom: 10px; margin-bottom: 20px;">Nová poptávka z webu DigitaleStudio.cz</h2>
                            <p><strong>Jméno odesílatele:</strong> ${name}</p>
                            <p><strong>E-mail:</strong> <a href="mailto:${email}">${email}</a></p>
                            <p><strong>Telefon:</strong> <a href="tel:${phone}">${phone}</a></p>
                            <p><strong>Předmět:</strong> ${subject}</p>
                            <h3 style="margin-top: 25px; color: #111827;">Obsah zprávy:</h3>
                            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; border-left: 4px solid #2b66ff; white-space: pre-wrap; color: #374151;">${message}</div>
                        </div>
                    `
                })
            }),
            // 2. Potvrzovací e-mail pro klienta na jeho zadanou adresu
            fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    from: 'info@digitalestudio.cz',
                    to: email,
                    subject: `Potvrzení přijetí poptávky: ${subject}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e5e7eb; border-radius: 12px; color: #1f2937; line-height: 1.6;">
                            <div style="text-align: center; margin-bottom: 20px;">
                                <h2 style="color: #2b66ff; margin: 0 0 10px 0; font-size: 22px;">Děkujeme za vaši poptávku!</h2>
                                <p style="color: #4b5563; font-size: 14px; margin: 0;">Obdrželi jsme vaši zprávu z webu DigitaleStudio.cz</p>
                            </div>
                            <p>Dobrý den, ${name},</p>
                            <p>tímto potvrzujeme, že jsme úspěšně přijali vaši zprávu. Naši specialisté se vašemu požadavku začnou věnovat a ozvou se vám zpět v nejbližším možném termínu (zpravidla do 24 hodin).</p>
                            
                            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 25px 0;">
                            
                            <h4 style="margin: 0 0 10px 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Shrnutí odeslaných údajů</h4>
                            <p style="margin: 4px 0; font-size: 14px;"><strong>Předmět:</strong> ${subject}</p>
                            <p style="margin: 4px 0; font-size: 14px;"><strong>Telefon:</strong> ${phone}</p>
                            <p style="margin: 15px 0 5px 0; font-size: 14px;"><strong>Vaše zpráva:</strong></p>
                            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; font-size: 13px; color: #4b5563; white-space: pre-wrap; border: 1px solid #f3f4f6;">${message}</div>
                            
                            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 25px 0;">
                            
                            <div style="text-align: center; font-size: 11px; color: #9ca3af;">
                                <p style="margin: 0 0 5px 0;">Tento e-mail byl odeslán automaticky systémem DigitaleStudio.cz.</p>
                                <p style="margin: 0;">Domoradická 87, 381 01 Český Krumlov</p>
                            </div>
                        </div>
                    `
                })
            })
        ]);

        // Kontrola stavu odeslání administrátorské notifikace
        if (!adminRes.ok) {
            const adminError = await adminRes.text();
            console.error('Resend Admin Error Response:', adminError);
            return res.status(500).json({ success: false, message: 'Chyba při odesílání notifikace administrátorovi.' });
        }

        // Kontrola stavu odeslání klientského potvrzení (neblokující pro celkový výsledek)
        if (!customerRes.ok) {
            const customerError = await customerRes.text();
            console.error('Resend Customer Error Response:', customerError);
        }

        return res.status(200).json({ success: true, message: 'Formulář byl úspěšně zpracován a e-maily odeslány.' });

    } catch (error) {
        console.error('Serverless Function Exception:', error);
        return res.status(500).json({ success: false, message: 'Nastala neočekávaná chyba serveru.' });
    }
}
