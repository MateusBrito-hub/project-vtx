interface IClient {
    socialName: string,
    fantasyName: string,
    CPF_CNPJ: string,
    IE?: string,   
    IM?: string,    
    owner: string,
    ownerDocument: string,     
    address: string,
    district: string,
    complement: string,
    UF: string,
    zipCode: string,
    slug: string,
    contact: string,
    email: string,
    planId: number
}


export {
    IClient
}