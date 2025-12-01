export function setupDropdowns() {
  function setupDropdown(inputId, dropdownId, options, groupLabels = []) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return null;
    function showDropdown(filteredOptions) {
      dropdown.innerHTML = '';
      filteredOptions.forEach((opt) => {
        const optionDiv = document.createElement('div');
        if (groupLabels.includes(opt)) {
          optionDiv.className = 'dropdown-option group-label';
          optionDiv.textContent = opt;
        } else {
          optionDiv.className = 'dropdown-option';
          optionDiv.textContent = opt;
          optionDiv.onclick = () => {
            input.value = opt;
            dropdown.style.display = 'none';
            input.dispatchEvent(new Event('change'));
          };
        }
        dropdown.appendChild(optionDiv);
      });
      dropdown.style.display = filteredOptions.length ? 'block' : 'none';
    }
    input.addEventListener('focus', function () {
      showDropdown(options);
    });
    input.addEventListener('click', function () {
      showDropdown(options);
    });
    input.addEventListener('input', function () {
      const val = input.value.trim().toLowerCase();
      showDropdown(options.filter((opt) => opt.toLowerCase().startsWith(val)));
    });
    document.addEventListener('mousedown', function (e) {
      if (!dropdown.contains(e.target) && e.target !== input) {
        dropdown.style.display = 'none';
      }
    });
    input.addEventListener('blur', function () {
      setTimeout(() => {
        dropdown.style.display = 'none';
      }, 200);
    });
    return {
      selectOption: function (optText) {
        input.value = optText;
        input.dispatchEvent(new Event('change'));
      }
    };
  }
  const resourceOptions = [
    'Fossil Fuels',
    'Oil & Gas',
    'LNG',
    'Coal',
    'Mining',
    'Any Mining',
    'ETMs',
    'Iron',
    'Aluminum/Bauxite',
    'Copper',
    'Nickel',
    'Cobalt',
    'Zinc',
    'Lead',
    'Gold',
    'Silver',
    'Platinum',
    'Palladium',
    'Lithium',
    'Graphite',
    'Tin',
    'Tantalum',
    'Tantalium',
    'Tungsten',
    'Manganese',
    'Chromium',
    'Molybdenum',
    'Vanadium',
    'Niobium',
    'Uranium',
    'Antimony',
    'Agroindustry',
    'Palm Oil',
    'Soy',
    'Cattle/Beef',
    'Logging',
    'Any Logging',
    'Timber',
    'Biofuels'
  ];
  const regionOptions = ['Global', 'Amazon', 'Congo', 'ASEAN', 'Africa', 'Asia', 'South America'];
  const countries = [
    'Afghanistan',
    'Albania',
    'Algeria',
    'Andorra',
    'Angola',
    'Argentina',
    'Armenia',
    'Australia',
    'Austria',
    'Azerbaijan',
    'Bahamas',
    'Bahrain',
    'Bangladesh',
    'Barbados',
    'Belarus',
    'Belgium',
    'Belize',
    'Benin',
    'Bhutan',
    'Bolivia',
    'Bosnia and Herzegovina',
    'Botswana',
    'Brazil',
    'Brunei',
    'Bulgaria',
    'Burkina Faso',
    'Burundi',
    'Cabo Verde',
    'Cambodia',
    'Cameroon',
    'Canada',
    'Central African Republic',
    'Chad',
    'Chile',
    'China',
    'Colombia',
    'Comoros',
    'Congo, Democratic Republic of the',
    'Congo, Republic of the',
    'Costa Rica',
    'Croatia',
    'Cuba',
    'Cyprus',
    'Czech Republic',
    'Denmark',
    'Djibouti',
    'Dominica',
    'Dominican Republic',
    'Ecuador',
    'Egypt',
    'El Salvador',
    'Equatorial Guinea',
    'Eritrea',
    'Estonia',
    'Eswatini',
    'Ethiopia',
    'Fiji',
    'Finland',
    'France',
    'Gabon',
    'Gambia',
    'Georgia',
    'Germany',
    'Ghana',
    'Greece',
    'Grenada',
    'Guatemala',
    'Guinea',
    'Guinea-Bissau',
    'Guyana',
    'Haiti',
    'Honduras',
    'Hungary',
    'Iceland',
    'India',
    'Indonesia',
    'Iran',
    'Iraq',
    'Ireland',
    'Israel',
    'Italy',
    'Jamaica',
    'Japan',
    'Jordan',
    'Kazakhstan',
    'Kenya',
    'Kiribati',
    'Korea, North',
    'Korea, South',
    'Kuwait',
    'Kyrgyzstan',
    'Laos',
    'Latvia',
    'Lebanon',
    'Lesotho',
    'Liberia',
    'Libya',
    'Liechtenstein',
    'Lithuania',
    'Luxembourg',
    'Madagascar',
    'Malawi',
    'Malaysia',
    'Maldives',
    'Mali',
    'Malta',
    'Marshall Islands',
    'Mauritania',
    'Mauritius',
    'Mexico',
    'Micronesia',
    'Moldova',
    'Monaco',
    'Mongolia',
    'Montenegro',
    'Morocco',
    'Mozambique',
    'Myanmar',
    'Namibia',
    'Nauru',
    'Nepal',
    'Netherlands',
    'New Zealand',
    'Nicaragua',
    'Niger',
    'Nigeria',
    'North Macedonia',
    'Norway',
    'Oman',
    'Pakistan',
    'Palau',
    'Palestine',
    'Panama',
    'Papua New Guinea',
    'Paraguay',
    'Peru',
    'Philippines',
    'Poland',
    'Portugal',
    'Qatar',
    'Romania',
    'Russia',
    'Rwanda',
    'Saint Kitts and Nevis',
    'Saint Lucia',
    'Saint Vincent and the Grenadines',
    'Samoa',
    'San Marino',
    'Sao Tome and Principe',
    'Saudi Arabia',
    'Senegal',
    'Serbia',
    'Seychelles',
    'Sierra Leone',
    'Singapore',
    'Slovakia',
    'Slovenia',
    'Solomon Islands',
    'Somalia',
    'South Africa',
    'South Sudan',
    'Spain',
    'Sri Lanka',
    'Sudan',
    'Suriname',
    'Sweden',
    'Switzerland',
    'Syria',
    'Taiwan',
    'Tajikistan',
    'Tanzania',
    'Thailand',
    'Timor-Leste',
    'Togo',
    'Tonga',
    'Trinidad and Tobago',
    'Tunisia',
    'Turkey',
    'Turkmenistan',
    'Tuvalu',
    'Uganda',
    'Ukraine',
    'United Arab Emirates',
    'United Kingdom',
    'United States',
    'Uruguay',
    'Uzbekistan',
    'Vanuatu',
    'Vatican City',
    'Venezuela',
    'Vietnam',
    'Yemen',
    'Zambia',
    'Zimbabwe'
  ];
  const resourceGroupLabels = ['Fossil Fuels', 'Mining', 'Agroindustry', 'Logging'];
  setupDropdown('resourceInput', 'resourceDropdown', resourceOptions, resourceGroupLabels);
  setupDropdown('regionInput', 'regionDropdown', regionOptions);
  setupDropdown('countryInput', 'countryDropdownList', countries);
}
