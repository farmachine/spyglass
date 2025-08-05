#!/usr/bin/env python3
"""
Test the enhanced content sanitization specifically for the Spanish Allianz document.
"""
import logging
from ai_extraction_simplified import sanitize_content_for_gemini

logging.basicConfig(level=logging.INFO)

print("🇪🇸 TESTING SPANISH DOCUMENT SANITIZATION")
print("=" * 45)

# Real content from the failing session
spanish_content = """
Tomador del Seguro
Nombre y apellidos: JOSHUA FREDERICK FARMER
NIE: Y9799103J
Dirección: CL ESTACADA DEL CURA, 24 41960 GINES

Datos del Conductor
Nombre Conductor: JOSHUA FREDERICK FARMER
NIF: Y9799103J
Fecha Carnet: 20/6/2008

Vehículo Asegurado
Matrícula: 9131KXV

Domicilio de Cobro
BANCO SANTANDER, S.A. N° de Cuenta
IBAN: BSCHESMMXXXES31*******6141

Centro de Atención al Cliente Allianz
Contact Center Clientes Allianz
Nacional: 901 100 128 (24H)
Internacional: 34 914 522 912
Teléfono: 900 300 250

Nº de Póliza: 054132424
Nº de recibo: 809585593

E-mail: estrada@grupoaico.com
Móvil: 601354218
Tel. 955027327
"""

print("📋 Original content contains:")
print(f"   • NIE number: Y9799103J")
print(f"   • Full name: JOSHUA FREDERICK FARMER") 
print(f"   • Address: CL ESTACADA DEL CURA, 24 41960 GINES")
print(f"   • Vehicle plate: 9131KXV")
print(f"   • IBAN: BSCHESMMXXXES31*******6141")
print(f"   • Phone numbers: 901 100 128, 34 914 522 912, etc.")
print(f"   • Email: estrada@grupoaico.com")
print(f"   • Policy numbers: 054132424, 809585593")

print(f"\n🧹 Applying content sanitization...")
sanitized = sanitize_content_for_gemini(spanish_content)

print(f"\n📊 Results:")
print(f"   Original length: {len(spanish_content):,} characters")
print(f"   Sanitized length: {len(sanitized):,} characters")
print(f"   Reduction: {len(spanish_content) - len(sanitized):,} characters")

print(f"\n🔒 Sanitized patterns found:")
patterns_found = []
if '[NIE]' in sanitized:
    patterns_found.append("NIE numbers")
if '[NIF]' in sanitized:
    patterns_found.append("NIF numbers") 
if '[PLATE]' in sanitized:
    patterns_found.append("Vehicle plates")
if '[IBAN]' in sanitized:
    patterns_found.append("Bank accounts")
if '[PHONE]' in sanitized:
    patterns_found.append("Phone numbers")
if '[MOBILE]' in sanitized:
    patterns_found.append("Mobile numbers")
if '[EMAIL]' in sanitized:
    patterns_found.append("Email addresses")
if '[POLICY_NUMBER]' in sanitized:
    patterns_found.append("Policy numbers")
if '[ADDRESS]' in sanitized:
    patterns_found.append("Addresses")

for pattern in patterns_found:
    print(f"   ✅ {pattern}")

print(f"\n📄 Sanitized content preview:")
print("-" * 30)
print(sanitized[:500] + "..." if len(sanitized) > 500 else sanitized)

# Test if the sanitized content would still trigger safety blocks
sensitive_indicators = [
    "JOSHUA FREDERICK FARMER",
    "Y9799103J", 
    "9131KXV",
    "BSCHESMMXXXES31", 
    "CL ESTACADA DEL CURA",
    "601354218"
]

remaining_sensitive = [indicator for indicator in sensitive_indicators if indicator in sanitized]

print(f"\n🚨 Remaining sensitive content:")
if remaining_sensitive:
    print(f"   ⚠️ Found {len(remaining_sensitive)} sensitive items still present:")
    for item in remaining_sensitive:
        print(f"      • {item}")
    print(f"   📝 May need additional sanitization patterns")
else:
    print(f"   ✅ All identified sensitive content has been sanitized")

print(f"\n💡 Enhanced sanitization now covers:")
print(f"   • Spanish NIE numbers (X/Y/Z + 7 digits + letter)")
print(f"   • Spanish NIF numbers (8 digits + letter)")  
print(f"   • Spanish vehicle plates (4 digits + 3 letters)")
print(f"   • IBAN patterns (both general and Spanish format)")
print(f"   • Spanish phone/mobile formats")
print(f"   • Spanish address patterns (CALLE/CL + postcode)")
print(f"   • Policy and account numbers")

if not remaining_sensitive:
    print(f"\n🎉 SUCCESS: Spanish document content fully sanitized!")
    print(f"   Session d62486a8-9a06-4e12-845d-860e26316dfa should now process correctly")
else:
    print(f"\n⚠️ PARTIAL: Some content may still trigger safety blocks")