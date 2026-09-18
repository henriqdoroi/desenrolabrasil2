export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido'
    });
  }

  try {
    const { cpf } = req.body || {};
    const rawCpf = String(cpf || '').replace(/\D/g, '');

    if (rawCpf.length !== 11) {
      return res.status(400).json({
        success: false,
        error: 'CPF inválido'
      });
    }

    // Token da Magma DataHub
    const token = process.env.MAGMA_DATAHUB_TOKEN || '07733964f4a553e7f443132911e0e4bb9028e19bbde8f86e9e3d248e1aa1b442';

    // Consulta a Magma DataHub
    const apiUrl = `https://magmadatahub.com/api.php?token=${encodeURIComponent(token)}&cpf=${encodeURIComponent(rawCpf)}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    const data = await response.json();

    console.log('Resposta Magma:', data);

    // Erro retornado pela Magma
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data?.error || data?.message || 'Não foi possível consultar o CPF'
      });
    }

    // Verifica se a API realmente retornou os dados esperados
    if (!data || !data.nome) {
      return res.status(404).json({
        success: false,
        error: 'CPF não encontrado'
      });
    }

    // Converte o formato da Magma para o formato que o frontend utiliza
    return res.status(200).json({
      success: true,
      data: {
        name: data.nome || '',
        birthDate: data.nascimento || '',
        gender: data.sexo || '',
        motherName: data.nome_mae || '',
        cpf: data.cpf || rawCpf
      }
    });

  } catch (error) {
    console.error('Erro CPF Magma:', error);

    return res.status(500).json({
      success: false,
      error: 'Erro ao consultar CPF'
    });
  }
}
